"""Private document extraction and evidence-based resume analysis."""

import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

try:
    from nltk.tokenize import TreebankWordTokenizer
    _TOKENIZER = TreebankWordTokenizer()
except ImportError:
    _TOKENIZER = None

from ml.skills import (canonical_skill_name, resolve_skill_key,
                       skill_text_contains, split_skill_values)


SKILLS = [
    "Python", "Java", "C", "C++", "SQL", "Machine Learning", "Scikit-learn", "Pandas", "NumPy",
    "Flask", "Django", "HTML", "CSS", "JavaScript", "React", "Git", "AWS", "Azure", "Docker",
    "Communication", "Data Structures", "Power BI", "Excel", "TensorFlow", "PyTorch", "Linux",
    "MongoDB", "MySQL", "Statistics", "Tableau",
]

SECTION_HEADERS = {
    "education": re.compile(r"^(education|academic background|qualifications?)\s*[:\-]*$", re.I),
    "projects": re.compile(r"^(projects?|academic projects?|personal projects?|selected projects?)\s*[:\-]*$", re.I),
    "experience": re.compile(r"^(professional experience|work experience|employment history|experience)\s*[:\-]*$", re.I),
    "internships": re.compile(r"^(internships?|industrial training)\s*[:\-]*$", re.I),
    "certifications": re.compile(r"^(certifications?|courses?|licenses?)\s*[:\-]*$", re.I),
    "technical_knowledge": re.compile(r"^(technical skills|technical knowledge|technologies|tools(?: and technologies)?|skills?)\s*[:\-]*$", re.I),
}
OTHER_SECTION_HEADERS = re.compile(
    r"^(summary|profile|objective|contact|achievements?|awards?|"
    r"publications?|languages?|interests?|activities|references)\s*[:\-]*$",
    re.I,
)
DEGREE_TERMS = re.compile(
    r"\b(?:B\.?\s?Tech|B\.?\s?E\.?|M\.?\s?Tech|M\.?\s?E\.?|B\.?\s?Sc|M\.?\s?Sc|"
    r"Bachelor(?:'s)?|Master(?:'s)?|Diploma|Ph\.?\s?D\.?)\b",
    re.I,
)


class ResumeReadError(ValueError):
    """A user-safe document validation or text extraction error."""


MAX_DOCUMENT_CHARS = 50000
MAX_PDF_PAGES = 50
MAX_OCR_PAGES = 20
MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


def _paragraph_and_table_text(document):
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    parts = []
    for element in document.element.body.iterchildren():
        if element.tag == qn("w:p"):
            value = Paragraph(element, document).text
            if value:
                parts.append(value)
        elif element.tag == qn("w:tbl"):
            table = Table(element, document)
            for row in table.rows:
                values = [re.sub(r"\s+", " ", cell.text).strip() for cell in row.cells]
                if any(values):
                    parts.append(" | ".join(values))
    return "\n".join(parts)


def _ps_quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def _extract_legacy_doc_with_word(path):
    if sys.platform != "win32" or not shutil.which("powershell.exe"):
        return ""
    with tempfile.TemporaryDirectory(prefix="campuslink-doc-") as folder:
        output = Path(folder) / "resume.txt"
        script = f"""
$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {{
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $document = $word.Documents.Open({_ps_quote(Path(path).resolve())}, $false, $true, $false)
  [System.IO.File]::WriteAllText({_ps_quote(output)}, $document.Content.Text, [System.Text.Encoding]::UTF8)
}} finally {{
  if ($document) {{ $document.Close(0) }}
  if ($word) {{ $word.Quit() }}
}}
"""
        encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
        try:
            subprocess.run(
                ["powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
                check=False, capture_output=True, timeout=25,
            )
        except (OSError, subprocess.TimeoutExpired):
            return ""
        if output.is_file():
            return output.read_text(encoding="utf-8-sig", errors="replace")
    return ""


def _extract_legacy_doc(path):
    for command in ("antiword", "catdoc"):
        executable = shutil.which(command)
        if executable:
            try:
                result = subprocess.run([executable, str(path)], capture_output=True, timeout=20, check=False)
            except (OSError, subprocess.TimeoutExpired):
                continue
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.decode("utf-8", errors="replace")

    office = shutil.which("soffice") or shutil.which("libreoffice")
    if office:
        with tempfile.TemporaryDirectory(prefix="campuslink-doc-") as folder:
            try:
                subprocess.run(
                    [office, "--headless", "--convert-to", "txt:Text", "--outdir", folder, str(path)],
                    capture_output=True, timeout=25, check=False,
                )
                converted = Path(folder) / f"{Path(path).stem}.txt"
                if converted.is_file():
                    return converted.read_text(encoding="utf-8", errors="replace")
            except (OSError, subprocess.TimeoutExpired):
                pass

    word_text = _extract_legacy_doc_with_word(path)
    if word_text:
        return word_text
    raise ResumeReadError(
        "This legacy .doc file needs Microsoft Word, LibreOffice, antiword, or catdoc on the server. "
        "If none is available, save the document as .docx and upload it again."
    )


def _extract_pdf_text(path):
    try:
        import pymupdf
    except ImportError:
        raise ResumeReadError(
            "PDF reading is unavailable in the active backend environment. "
            "Install the packages from backend/requirements.txt and restart the backend."
        ) from None

    with pymupdf.open(path) as document:
        if document.needs_pass:
            raise ResumeReadError("This PDF is password-protected. Upload an unlocked copy of the resume.")
        if document.page_count > MAX_PDF_PAGES:
            raise ResumeReadError(f"This PDF has more than {MAX_PDF_PAGES} pages. Upload a shorter resume.")

        extracted_pages = []
        pages_needing_ocr = []
        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text("text")
            if len(page_text.strip()) < 20 and (page.get_images(full=True) or page.get_drawings()):
                pages_needing_ocr.append((page_number, page))
                extracted_pages.append(None)
            else:
                extracted_pages.append(page_text)

        if len(pages_needing_ocr) > MAX_OCR_PAGES:
            raise ResumeReadError(
                f"This scanned PDF has more than {MAX_OCR_PAGES} pages that need OCR. "
                "Upload a shorter resume or split it into smaller files."
            )

        if pages_needing_ocr:
            language = os.getenv("RESUME_OCR_LANGUAGE", "eng").strip() or "eng"
            tessdata = os.getenv("TESSDATA_PREFIX", "").strip() or None
            for page_number, page in pages_needing_ocr:
                try:
                    text_page = page.get_textpage_ocr(
                        language=language, dpi=200, full=True, tessdata=tessdata
                    )
                    extracted_pages[page_number - 1] = page.get_text("text", textpage=text_page)
                except Exception:
                    raise ResumeReadError(
                        "This PDF appears to be scanned, but OCR is not ready on the server. "
                        "Install Tesseract OCR with English language data, set TESSDATA_PREFIX "
                        "to its tessdata folder in backend/.env, and restart CAMPUSLINK."
                    ) from None

        text = "\n".join(page_text or "" for page_text in extracted_pages)
        if not text.strip():
            raise ResumeReadError(
                "No readable text could be extracted from this PDF. Check the scan quality "
                "and the configured OCR language, then try again."
            )
        return text


def extract_text(path):
    suffix = Path(path).suffix.lower()
    try:
        if suffix == ".pdf":
            text = _extract_pdf_text(path)
        elif suffix == ".docx":
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
                if "word/document.xml" not in names or "[Content_Types].xml" not in names:
                    raise ResumeReadError("This .docx file is not a valid Word document.")
                if sum(item.file_size for item in archive.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
                    raise ResumeReadError("This Word document expands beyond the safe processing limit.")
            from docx import Document
            text = _paragraph_and_table_text(Document(path))
        elif suffix == ".doc":
            text = _extract_legacy_doc(path)
        elif suffix == ".txt":
            text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
        else:
            raise ResumeReadError("Supported documents are PDF, DOCX, or legacy DOC files.")
    except ResumeReadError:
        raise
    except Exception as error:
        error_name = type(error).__name__.casefold()
        if suffix == ".pdf" and "password" in str(error).casefold():
            raise ResumeReadError("This PDF is password-protected. Upload an unlocked copy of the resume.") from None
        if suffix == ".pdf" and any(word in error_name for word in ("filedata", "runtime", "format")):
            raise ResumeReadError("This PDF is damaged or unreadable. Try exporting it again and re-uploading it.") from None
        if suffix == ".docx" and isinstance(error, (zipfile.BadZipFile, KeyError)):
            raise ResumeReadError("This .docx file is damaged or unreadable. Try saving it again in Word.") from None
        raise ResumeReadError("The document could not be read. Check that it is not corrupted or encrypted, then try again.") from None

    text = re.sub(r"\x00", "", str(text or ""))[:MAX_DOCUMENT_CHARS]
    if not text.strip():
        raise ResumeReadError("No readable text was found in this document.")
    return text


def _section_entries(text):
    current = None
    sections = {name: [] for name in SECTION_HEADERS}
    for raw_line in str(text or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        header = next((name for name, pattern in SECTION_HEADERS.items() if pattern.fullmatch(line)), None)
        if header:
            current = header
            continue
        if OTHER_SECTION_HEADERS.fullmatch(line):
            current = None
            continue
        if len(line) < 8 or len(line) > 260:
            continue
        if current:
            cleaned = re.sub(r"^[\s•*·\-–—]+", "", line).strip()
            if cleaned and cleaned.casefold() not in {item.casefold() for item in sections[current]}:
                sections[current].append(cleaned)
    return {name: values[:8] for name, values in sections.items()}


def _unique_names(values, limit=80):
    result = []
    seen = set()
    for value in values:
        name = str(value or "").strip()
        key = name.casefold()
        if name and key not in seen:
            seen.add(key)
            result.append(name)
        if len(result) >= limit:
            break
    return result


PARTIAL_SKILL_EVIDENCE = {
    "sql": {"mysql", "postgresql", "sqlite", "microsoft sql server", "oracle database"},
    "machine learning": {"scikit-learn", "tensorflow", "pytorch"},
    "cloud computing": {"aws", "azure", "google cloud", "gcp"},
    "data analytics": {"pandas", "power bi", "tableau", "excel"},
    "web development": {"html", "css", "javascript", "react"},
}


def _detected_skills(source, skill_catalog=None):
    catalog = split_skill_values(skill_catalog or [])
    skills = split_skill_values([*SKILLS, *catalog])
    found = [canonical_skill_name(skill) for skill in skills
             if resolve_skill_key(skill) != "c" and skill_text_contains(source, skill)]
    # The one-letter language name is too ambiguous for unrestricted text matching.
    if re.search(r"\bC\s*(?:programming|language)\b|\bC\s*/\s*C\+\+|\bC\s*,\s*(?:C\+\+|Java|Python)\b", source, re.I):
        found.append("C")
    return _unique_names(found)


def extract_target_skills(text, skill_catalog=None):
    """Find known skill requirements in a job description without guessing."""
    return _detected_skills(str(text or ""), skill_catalog)


def redact_personal_contact_details(text):
    source = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email removed]", str(text or ""), flags=re.I)
    return re.sub(r"(?<!\w)\+?\d[\d \t().-]{8,}\d(?!\w)", "[phone removed]", source)


def analyze_resume(text, skill_catalog=None, target_skills=None):
    source = str(text or "")
    low = source.casefold()
    detected = _detected_skills(source, skill_catalog)
    sections = {
        "education": bool(re.search(r"education|university|college|bachelor|b\.tech|b\.e\.", low)),
        "projects": bool(re.search(r"project|built|developed|implemented", low)),
        "internships": bool(re.search(r"intern(ship)?|trainee|work experience", low)),
        "certifications": bool(re.search(r"certification|certificate|coursera|nptel", low)),
        "experience": bool(re.search(r"experience|employment|worked at", low)),
        "technical_knowledge": bool(re.search(r"technical skills|technical knowledge|skills|technologies|tools", low)),
    }
    extracted = _section_entries(source)
    qualifications = _unique_names(
        [line for line in extracted["education"] if DEGREE_TERMS.search(line)]
        + [line.strip() for line in source.splitlines() if DEGREE_TERMS.search(line)],
        limit=8,
    )
    catalog = split_skill_values(skill_catalog or [])
    targets = split_skill_values(target_skills or [], [*SKILLS, *catalog])[:40]
    detected_keys = {resolve_skill_key(skill) for skill in detected}
    matched = [skill for skill in targets if resolve_skill_key(skill) in detected_keys]
    partial = []
    missing = []
    for skill in targets:
        skill_key = resolve_skill_key(skill)
        if skill_key in detected_keys:
            continue
        evidence_keys = {resolve_skill_key(item) for item in PARTIAL_SKILL_EVIDENCE.get(skill_key, set())}
        evidence = [name for name in detected if resolve_skill_key(name) in evidence_keys]
        if evidence:
            partial.append({"skill": skill, "evidence": evidence})
        else:
            missing.append(skill)
    partial_keys = {resolve_skill_key(item["skill"]) for item in partial}
    target_keys = {resolve_skill_key(skill) for skill in targets}
    additional = [skill for skill in detected if resolve_skill_key(skill) not in target_keys and resolve_skill_key(skill) not in partial_keys]
    match_percentage = round(100 * len(matched) / len(targets)) if targets else None
    sections_score = round(100 * sum(sections.values()) / len(sections))
    score = match_percentage if match_percentage is not None else sections_score
    evidence = {
        "education": extracted["education"],
        "experience": extracted["experience"],
        "internships": extracted["internships"],
        "projects": extracted["projects"],
        "certifications": extracted["certifications"],
        "technical_knowledge": extracted["technical_knowledge"],
    }
    projects = evidence["projects"]
    suggestions = []
    if not sections["projects"]:
        suggestions.append("Add a projects section with your role, tools, and measurable results.")
    elif not projects:
        suggestions.append("Use clear project headings so project evidence is easy to identify.")
    if not sections["education"]:
        suggestions.append("Add your degree, institution, and expected graduation year.")
    if not sections["experience"] and not sections["internships"]:
        suggestions.append("Include internship, volunteering, or practical experience when available.")
    if missing:
        suggestions.append("Add genuine project or work evidence for these role requirements where you have the experience: " + ", ".join(missing[:5]) + ".")
    if not suggestions:
        suggestions.append("Use measurable outcomes to make your strongest experience easier to evaluate.")
    words = _TOKENIZER.tokenize(source) if _TOKENIZER else source.split()
    strengths = [name.replace("_", " ").title() for name, found in sections.items() if found]
    if detected:
        strengths.append("Relevant technical skills")
    weaknesses = []
    if missing:
        weaknesses.append("No clear resume evidence was found for: " + ", ".join(missing[:8]))
    if not evidence["experience"] and not evidence["internships"]:
        weaknesses.append("No work or internship entries were identified in a labeled section.")
    if not evidence["projects"]:
        weaknesses.append("No project entries were identified in a labeled section.")
    return {
        "score": score,
        "match_percentage": match_percentage,
        "detected_skills": detected,
        "matched_skills": matched,
        "partially_matched_skills": partial,
        "missing_skills": missing,
        "total_required_skills": len(targets),
        "additional_relevant_skills": additional,
        "sections": sections,
        "strengths": strengths,
        "weaknesses": weaknesses,
        **evidence,
        "projects": evidence["projects"],
        "qualifications": qualifications,
        "target_skills": targets[:12],
        "suggestions": suggestions,
        "word_count": len(words),
        "note": "Skills and evidence are extracted from resume text and may need manual review.",
    }
