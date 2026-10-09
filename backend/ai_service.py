"""Backend-only provider client for CAMPUSLINK's configured Groq service."""

import json
import logging
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from dotenv import dotenv_values


BACKEND_ENV_FILE = Path(__file__).resolve().parent / ".env"
GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL_DEFAULT = "openai/gpt-oss-120b"
OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
QUIZ_MODEL_DEFAULT = "deepseek/deepseek-v4.1-flash"
AI_REQUEST_TIMEOUT = 25
AI_RETRY_ATTEMPTS = 3
AI_RETRY_BASE_DELAY = 0.75


class AIServiceError(Exception):
    """A user-safe error from the configured AI service."""


def _redact_secret(value, api_key=""):
    text_value = str(value or "")
    if api_key:
        text_value = text_value.replace(api_key, "[REDACTED]")
    text_value = re.sub(r"\bgsk_[0-9A-Za-z_-]{20,}\b", "[REDACTED]", text_value)
    return re.sub(r"\bsk-[0-9A-Za-z_-]{16,}\b", "[REDACTED]", text_value)


def _error_detail(error, api_key):
    try:
        body = error.read(8192).decode("utf-8", errors="replace")
    except (OSError, ValueError):
        body = ""
    finally:
        try:
            error.close()
        except (AttributeError, OSError):
            pass
    try:
        payload = json.loads(body)
        detail = payload.get("error", {}).get("message", body) if isinstance(payload, dict) else body
    except (json.JSONDecodeError, AttributeError):
        detail = body
    return " ".join(_redact_secret(detail, api_key).split())[:600] or "Groq returned no error details."


def _http_error_message(status, model, detail=""):
    if status == 401:
        return "Groq authentication failed (HTTP 401). Check GROQ_API_KEY in backend/.env."
    if status == 403:
        if re.search(r"\b1010\b", detail):
            return "Groq's edge security blocked this API connection (HTTP 403, code 1010). Try another network or contact Groq support."
        return "Groq access was forbidden (HTTP 403). Check API access and key permissions in GroqCloud."
    if status == 404:
        return f"Groq model '{model}' was not found (HTTP 404). Check GROQ_MODEL in backend/.env."
    if status == 429:
        return "Groq is rate limiting requests (HTTP 429). Please wait briefly and try again."
    if status == 500:
        return "Groq returned a server error (HTTP 500). Please try again shortly."
    if status == 503:
        return "Groq is temporarily unavailable (HTTP 503). Please try again shortly."
    if 500 <= status <= 599:
        return f"Groq returned a server error (HTTP {status}). Please try again shortly."
    return f"Groq returned HTTP {status}. Check the backend terminal for details."


def _retry_delay(error, attempt):
    retry_after = error.headers.get("Retry-After") if error.headers else None
    try:
        delay = float(retry_after) if retry_after else AI_RETRY_BASE_DELAY * (2 ** (attempt - 1))
    except (TypeError, ValueError):
        delay = AI_RETRY_BASE_DELAY * (2 ** (attempt - 1))
    return min(max(delay, 0), 5)


def request_groq(messages, system_instruction, logger=None, max_completion_tokens=900):
    """Send one bounded completion request; secrets and provider details stay server-side."""
    logger = logger or logging.getLogger("campuslink.ai")
    config = dotenv_values(BACKEND_ENV_FILE)
    api_key = str(config.get("GROQ_API_KEY") or "").strip()
    if not api_key:
        logger.error("Groq is not configured: GROQ_API_KEY is missing or empty in backend/.env.")
        raise AIServiceError("The AI assistant is not configured yet. Set GROQ_API_KEY in backend/.env.")

    model = str(config.get("GROQ_MODEL") or GROQ_MODEL_DEFAULT).strip()
    if not re.fullmatch(r"[A-Za-z0-9._/-]{3,100}", model):
        logger.error("Groq configuration contains an invalid model name in backend/.env.")
        raise AIServiceError("The configured Groq model name is invalid. Check GROQ_MODEL in backend/.env.")

    logger.info("Groq request configured (model=%s, messages=%s).", model, len(messages))
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_instruction}] + [
            {"role": message["role"], "content": message["content"]} for message in messages
        ],
        "temperature": 0.35,
        "max_completion_tokens": max(128, min(int(max_completion_tokens), 5000)),
    }

    result = None
    for attempt in range(1, AI_RETRY_ATTEMPTS + 1):
        req = Request(
            GROQ_API_ENDPOINT,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "CampusLink/1.0 (Groq API client)",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=AI_REQUEST_TIMEOUT) as response:
                response_status = response.status
                response_body = response.read().decode("utf-8")
            logger.info("Groq HTTP %s (model=%s).", response_status, model)
            result = json.loads(response_body)
            if not isinstance(result, dict):
                raise json.JSONDecodeError("Provider response must be an object", response_body, 0)
            break
        except HTTPError as error:
            status = error.code
            detail = _error_detail(error, api_key)
            headers = error.headers or {}
            logger.warning(
                "Groq HTTP %s on attempt %s/%s (model=%s, server=%s, cf-ray=%s): %s",
                status, attempt, AI_RETRY_ATTEMPTS, model,
                headers.get("Server"), headers.get("CF-Ray"), detail,
            )
            if (status == 429 or 500 <= status <= 599) and attempt < AI_RETRY_ATTEMPTS:
                delay = _retry_delay(error, attempt)
                logger.info("Retrying Groq HTTP %s after %.2f seconds.", status, delay)
                time.sleep(delay)
                continue
            raise AIServiceError(_http_error_message(status, model, detail)) from None
        except (URLError, TimeoutError, OSError) as error:
            reason = _redact_secret(getattr(error, "reason", error), api_key)
            logger.warning("Groq connection failed (%s): %s", type(error).__name__, reason[:300])
            raise AIServiceError("The AI assistant could not reach Groq. Check the backend connection and try again.") from None
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            logger.warning("Groq returned an unreadable response (%s, model=%s).", type(error).__name__, model)
            raise AIServiceError("Groq returned an unreadable response. Please try again shortly.") from None

    choices = result.get("choices") or []
    answer = str((choices[0].get("message") or {}).get("content") or "").strip() if choices else ""
    if not answer:
        logger.warning("Groq returned HTTP 200 without assistant text (model=%s).", model)
        raise AIServiceError("Groq could not produce a response. Try a shorter or clearer question.")
    return answer[:10000], model


def _request_compatible_fallback(messages, system_instruction, config, logger):
    base_url = str(config.get("QUIZ_FALLBACK_BASE_URL") or "").strip().rstrip("/")
    api_key = str(config.get("QUIZ_FALLBACK_API_KEY") or "").strip()
    model = str(config.get("QUIZ_FALLBACK_MODEL") or "").strip()
    parsed_url = urlsplit(base_url)
    if (parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password
            or parsed_url.query or parsed_url.fragment):
        raise AIServiceError("The configured quiz fallback endpoint is invalid.")
    if not api_key or not re.fullmatch(r"[A-Za-z0-9._/-]{3,100}", model):
        raise AIServiceError("The configured quiz fallback provider is incomplete.")

    endpoint = f"{base_url}/chat/completions"
    provider = parsed_url.hostname
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_instruction}] + [
            {"role": message["role"], "content": message["content"]} for message in messages
        ],
        "temperature": 0.35,
        "max_completion_tokens": 3000,
    }
    for attempt in range(1, AI_RETRY_ATTEMPTS + 1):
        req = Request(endpoint, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {api_key}",
            "User-Agent": "CampusLink/1.0 (quiz fallback client)",
        }, method="POST")
        try:
            with urlopen(req, timeout=AI_REQUEST_TIMEOUT) as response:
                status = response.status
                body = response.read().decode("utf-8")
            data = json.loads(body)
            answer = str((((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
            if not answer:
                raise AIServiceError("The quiz fallback provider returned no question data.")
            logger.info("Quiz fallback HTTP %s (provider=%s, model=%s).", status, provider, model)
            return answer[:20000], model
        except HTTPError as error:
            status = error.code
            detail = _error_detail(error, api_key)
            logger.warning("Quiz fallback HTTP %s (provider=%s, model=%s): %s", status, provider, model, detail)
            if (status == 429 or 500 <= status <= 599) and attempt < AI_RETRY_ATTEMPTS:
                time.sleep(_retry_delay(error, attempt))
                continue
            raise AIServiceError(f"Quiz fallback provider returned HTTP {status}.") from None
        except (URLError, TimeoutError, OSError) as error:
            logger.warning("Quiz fallback connection failed (provider=%s, error=%s).", provider, type(error).__name__)
            raise AIServiceError("The quiz fallback provider could not be reached.") from None
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError, TypeError) as error:
            logger.warning("Quiz fallback response was unreadable (provider=%s, error=%s).", provider, type(error).__name__)
            raise AIServiceError("The quiz fallback provider returned an unreadable response.") from None
    raise AIServiceError("The quiz fallback provider is temporarily unavailable.")


def request_quiz_generation(messages, system_instruction, logger=None):
    """Generate Quick Quiz content through OpenRouter; the assistant remains on Groq."""
    logger = logger or logging.getLogger("campuslink.ai")
    config = dotenv_values(BACKEND_ENV_FILE)
    api_key = str(config.get("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        logger.error("Quick Quiz AI is not configured: OPENROUTER_API_KEY is missing in backend/.env.")
        raise AIServiceError("AI quiz generation is not configured. Set OPENROUTER_API_KEY in backend/.env.")

    model = str(config.get("QUIZ_MODEL") or QUIZ_MODEL_DEFAULT).strip()
    if not re.fullmatch(r"[A-Za-z0-9._/-]{3,100}(?::[A-Za-z0-9._-]{1,30})?", model):
        logger.error("Quick Quiz AI configuration contains an invalid QUIZ_MODEL value.")
        raise AIServiceError("The configured quiz model name is invalid. Check QUIZ_MODEL in backend/.env.")

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_instruction}] + [
            {"role": message["role"], "content": message["content"]} for message in messages
        ],
        "temperature": 0.55,
        "max_tokens": 5000,
    }
    logger.info("OpenRouter Quick Quiz request configured (model=%s, messages=%s).", model, len(messages))
    for attempt in range(1, AI_RETRY_ATTEMPTS + 1):
        req = Request(
            OPENROUTER_CHAT_ENDPOINT,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://campuslink.local",
                "X-Title": "CAMPUSLINK Quick Quiz",
                "User-Agent": "CampusLink/1.0 (OpenRouter quiz client)",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=AI_REQUEST_TIMEOUT) as response:
                status = response.status
                body = response.read().decode("utf-8")
            result = json.loads(body)
            if not isinstance(result, dict):
                raise json.JSONDecodeError("Provider response must be an object", body, 0)
            answer = str((((result.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
            logger.info("OpenRouter Quick Quiz HTTP %s (model=%s).", status, model)
            if not answer:
                raise AIServiceError("The quiz model returned no questions. Please retry.")
            return answer[:30000], model, "OpenRouter"
        except HTTPError as error:
            status = error.code
            detail = _error_detail(error, api_key)
            logger.warning("OpenRouter Quick Quiz HTTP %s on attempt %s/%s (model=%s): %s",
                           status, attempt, AI_RETRY_ATTEMPTS, model, detail)
            if (status == 429 or 500 <= status <= 599) and attempt < AI_RETRY_ATTEMPTS:
                delay = _retry_delay(error, attempt)
                logger.info("Retrying OpenRouter Quick Quiz HTTP %s after %.2f seconds.", status, delay)
                time.sleep(delay)
                continue
            if status == 401:
                safe_message = "OpenRouter authentication failed (HTTP 401). Check OPENROUTER_API_KEY in backend/.env."
            elif status == 403:
                safe_message = "OpenRouter access was forbidden (HTTP 403). Check key permissions and account access."
            elif status == 404:
                safe_message = f"OpenRouter could not find quiz model '{model}' (HTTP 404). Check QUIZ_MODEL in backend/.env."
            elif status == 402:
                safe_message = "OpenRouter requires available credits for this model (HTTP 402). Check the selected model and account."
            elif status == 429:
                safe_message = "OpenRouter is rate limiting quiz requests (HTTP 429). Please retry shortly."
            elif status in {500, 502, 503}:
                safe_message = f"OpenRouter is temporarily unavailable (HTTP {status}). Please retry shortly."
            else:
                safe_message = f"OpenRouter returned HTTP {status}. Check the backend terminal for details."
            raise AIServiceError(safe_message) from None
        except (URLError, TimeoutError, OSError) as error:
            reason = _redact_secret(getattr(error, "reason", error), api_key)
            logger.warning("OpenRouter Quick Quiz connection failed (attempt=%s/%s, error=%s): %s",
                           attempt, AI_RETRY_ATTEMPTS, type(error).__name__, reason[:240])
            if attempt < AI_RETRY_ATTEMPTS:
                time.sleep(min(AI_RETRY_BASE_DELAY * (2 ** (attempt - 1)), 5))
                continue
            raise AIServiceError("Could not reach the quiz AI provider. Check the backend connection and retry.") from None
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError, TypeError) as error:
            logger.warning("OpenRouter Quick Quiz response was unreadable (model=%s, error=%s).",
                           model, type(error).__name__)
            raise AIServiceError("The quiz AI provider returned unreadable data. Please retry.") from None
    raise AIServiceError("The quiz AI provider is temporarily unavailable. Please retry.")
