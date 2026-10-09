"""Small local intent router; Groq remains the semantic answer engine."""

import re
import unicodedata

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:  # Intent routing remains available in minimal installations.
    TfidfVectorizer = cosine_similarity = None


INTENT_EXAMPLES = {
    "placement": ["how can I prepare for campus placements", "placement readiness and hiring process", "how do I get a job through campus"],
    "interview": ["help me prepare for an interview", "ask me HR interview questions", "how should I answer tell me about yourself"],
    "resume": ["review my resume and improve it", "what should I add to my CV", "how can I write a resume"],
    "aptitude": ["give me a quantitative aptitude question", "practice reasoning and placement aptitude", "help me solve a logical reasoning problem"],
    "coding": ["give me a coding problem", "help me debug this program", "practice a programming challenge"],
    "learning_resources": ["recommend a tutorial or learning video", "where can I learn python", "find a course for this skill"],
    "branch": ["give advice for my engineering branch", "what subjects matter for CSE AI", "career prep for electronics and communication"],
    "company_information": ["tell me about a company or vacancy", "what does this employer require", "which jobs are available at this company"],
    "communication": ["help me improve spoken English", "correct my grammar and vocabulary", "practice professional communication"],
    "career_guidance": ["what career should I choose", "which role suits my interests and skills", "help me plan my career path"],
    "technical": ["explain a technical concept", "how does a database work", "teach me machine learning basics"],
    "campus_student": ["how do I use the student dashboard", "help me track my applications", "what can I do in campuslink"],
    "general": ["hello", "I have a general question", "can you explain this topic"],
}

ABBREVIATIONS = {
    "pls": "please", "plz": "please", "u": "you", "ur": "your", "r": "are",
    "im": "i am", "ive": "i have", "wht": "what", "hw": "how", "abt": "about",
    "interveiw": "interview", "intreview": "interview", "resme": "resume",
    "resum": "resume", "plcemnt": "placement", "placemnt": "placement",
    "collage": "college", "reccomend": "recommend", "recomend": "recommend",
}

_EXAMPLE_INTENTS = [(intent, example) for intent, examples in INTENT_EXAMPLES.items() for example in examples]
_INTENT_VECTORIZER = None
_INTENT_MATRIX = None
if TfidfVectorizer:
    _INTENT_VECTORIZER = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    _INTENT_MATRIX = _INTENT_VECTORIZER.fit_transform([example for _, example in _EXAMPLE_INTENTS])


def normalize_user_text(value):
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = re.sub(r"[^\w+#.\s'’-]", " ", text, flags=re.UNICODE)
    tokens = re.findall(r"[\w+#.]+|['’]", text, flags=re.UNICODE)
    return " ".join(ABBREVIATIONS.get(token, token) for token in tokens)


def _classify_normalized(query):
    if not query:
        return "general", 0.0, "empty"
    if _INTENT_VECTORIZER is not None:
        vector = _INTENT_VECTORIZER.transform([query])
        scores = cosine_similarity(vector, _INTENT_MATRIX).ravel()
        best_index = int(scores.argmax()) if len(scores) else 0
        intent, _ = _EXAMPLE_INTENTS[best_index]
        score = float(scores[best_index])
        if score >= 0.08:
            return intent, round(score, 3), "tfidf_similarity"

    tokens = set(query.split())
    fallback_terms = {
        "placement": {"placement", "job", "hiring", "company", "career"},
        "interview": {"interview", "hr", "behavioral"}, "resume": {"resume", "cv"},
        "aptitude": {"aptitude", "reasoning", "quantitative"}, "coding": {"code", "coding", "programming", "debug"},
        "learning_resources": {"resource", "video", "course", "learn", "tutorial"},
        "branch": {"branch", "cse", "ece", "eee", "civil", "mechanical"},
        "company_information": {"company", "vacancy", "vacancies", "employer"},
        "communication": {"communication", "grammar", "vocabulary", "speaking", "english"},
        "career_guidance": {"career", "goal", "interest", "roadmap"},
        "technical": {"technical", "database", "algorithm", "machine", "system"},
        "campus_student": {"campuslink", "dashboard", "application", "profile"},
    }
    ranked = sorted(((len(tokens & terms), intent) for intent, terms in fallback_terms.items()), reverse=True)
    if ranked and ranked[0][0]:
        return ranked[0][1], round(min(0.25 + 0.1 * ranked[0][0], 0.7), 3), "keyword_fallback"
    return "general", 0.0, "general_fallback"


def classify_intent(value):
    normalized = normalize_user_text(value)
    intent, confidence, method = _classify_normalized(normalized)
    return {"intent": intent, "confidence": confidence, "method": method, "normalized_query": normalized}
