"""Shared, exact skill parsing and alias handling for CAMPUSLINK."""

import re
import unicodedata


BUILTIN_SKILLS = (
    "Python", "Java", "C", "C++", "C#", "SQL", "Machine Learning", "Scikit-learn",
    "Pandas", "NumPy", "Flask", "Django", "HTML", "CSS", "JavaScript", "React",
    "Git", "AWS", "Azure", "Docker", "Communication", "Data Structures", "Power BI",
    "Excel", "TensorFlow", "PyTorch", "Linux", "MongoDB", "MySQL", "PostgreSQL",
    "Statistics", "Tableau", "Node.js", "TypeScript", "Angular", "PHP", "Ruby", "Go",
    "Kotlin", "Swift", "Redis", "Oracle Database", "Microsoft SQL Server", "SQLite",
    "Google Cloud", "GCP", "Data Science", "Web Development", "Data Analytics",
    "Aptitude", "Problem Solving", "Communication Skills", "PowerPoint", "Jupyter",
)


def normalize_skill_name(value):
    """Normalize a single skill label while preserving meaningful symbols."""
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = text.replace("&", " and ")
    text = re.sub(r"[^\w+#.]+", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


_ALIASES = {
    "numpy": "numpy",
    "num py": "numpy",
    "pandas": "pandas",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "postgre sql": "postgresql",
    "js": "javascript",
    "java script": "javascript",
    "javascript": "javascript",
    "structured query language": "sql",
    "c plus plus": "c++",
    "cpp": "c++",
    "c++": "c++",
    "c sharp": "c#",
    "c#": "c#",
    "scikit learn": "scikit learn",
    "sklearn": "scikit learn",
    "node js": "node js",
    "nodejs": "node js",
    "node.js": "node js",
    "powerbi": "power bi",
    "ml": "machine learning",
    "machine learning": "machine learning",
    "aws cloud": "aws",
    "google cloud platform": "google cloud",
    "gcp": "google cloud",
    "sqlite": "sqlite",
}

_CANONICAL_NAMES = {
    "python": "Python",
    "java": "Java",
    "c": "C",
    "flask": "Flask",
    "django": "Django",
    "html": "HTML",
    "css": "CSS",
    "react": "React",
    "git": "Git",
    "aws": "AWS",
    "azure": "Azure",
    "docker": "Docker",
    "communication": "Communication",
    "data structures": "Data Structures",
    "excel": "Excel",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "linux": "Linux",
    "statistics": "Statistics",
    "tableau": "Tableau",
    "angular": "Angular",
    "typescript": "TypeScript",
    "ruby": "Ruby",
    "go": "Go",
    "kotlin": "Kotlin",
    "swift": "Swift",
    "redis": "Redis",
    "numpy": "NumPy",
    "pandas": "Pandas",
    "postgresql": "PostgreSQL",
    "javascript": "JavaScript",
    "sql": "SQL",
    "c++": "C++",
    "c#": "C#",
    "scikit learn": "Scikit-learn",
    "node js": "Node.js",
    "power bi": "Power BI",
    "machine learning": "Machine Learning",
    "aws": "AWS",
    "google cloud": "Google Cloud",
    "gcp": "Google Cloud",
    "html": "HTML",
    "css": "CSS",
    "git": "Git",
    "sql": "SQL",
    "mysql": "MySQL",
    "mongodb": "MongoDB",
    "api": "API",
    "php": "PHP",
}

_IGNORED_LABELS = {"skill", "skills", "technology", "technologies", "tool", "tools", "programming", "language", "languages"}
_SEPARATORS = re.compile(r"[,;\r\n|/•·]+|\s+-\s+|\band\b", re.I)
_TOKEN = re.compile(r"\.?[a-z0-9][a-z0-9+#.]*", re.I)


def resolve_skill_key(value):
    """Return a case-insensitive canonical key, applying only explicit aliases."""
    normalized = normalize_skill_name(value)
    return _ALIASES.get(normalized, normalized)


def canonical_skill_name(value):
    """Return a readable canonical label for known skills, preserving unknown labels."""
    key = resolve_skill_key(value)
    if not key:
        return ""
    if key in _CANONICAL_NAMES:
        return _CANONICAL_NAMES[key]
    cleaned = " ".join(str(value or "").split()).strip(" ,;|/•·")
    return cleaned or key


def _record_value(value):
    if isinstance(value, dict):
        for field in ("name", "skill", "title"):
            if value.get(field) is not None:
                return str(value[field])
        return ""
    # Strings expose a callable .title method; do not treat that as a record field.
    if isinstance(value, str):
        return value
    for field in ("name", "skill", "title"):
        field_value = getattr(value, field, None)
        if field_value is not None:
            return str(field_value)
    return ""


def _simple_chunks(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        chunks = []
        for item in value:
            chunks.extend(_simple_chunks(item))
        return chunks
    raw = _record_value(value)
    if not raw:
        return []
    return [part.strip() for part in _SEPARATORS.split(raw) if part.strip()]


def _known_skill_trie(skill_catalog):
    variants = [*BUILTIN_SKILLS, *list(_ALIASES.keys())]
    base_known = {}
    for variant in variants:
        tokens = tuple(normalize_skill_name(token) for token in _TOKEN.findall(variant))
        if tokens:
            base_known[tokens] = resolve_skill_key(variant)
    catalog_variants = []
    for chunk in _simple_chunks(skill_catalog):
        parsed = _parse_chunk(chunk, base_known)
        # A stale database row can contain multiple space-separated skills.
        # Expand recognized names instead of treating the whole row as one skill.
        catalog_variants.extend(parsed if len(parsed) > 1 else [chunk])
    variants.extend(catalog_variants)
    known = {}
    for variant in variants:
        tokens = tuple(normalize_skill_name(token) for token in _TOKEN.findall(variant))
        if tokens:
            known[tokens] = resolve_skill_key(variant)
    return known


def _parse_chunk(chunk, known):
    # Ignore common field labels so values like "Technical Skills: Python SQL"
    # do not become a fake skill named "Technical Skills".
    chunk = re.sub(r"^(?:technical\s+)?skills?\s*[:\-]\s*", "", chunk, flags=re.I)
    chunk = re.sub(r"^(?:programming\s+)?languages?\s*[:\-]\s*", "", chunk, flags=re.I)
    token_matches = list(_TOKEN.finditer(chunk))
    raw_tokens = [match.group(0) for match in token_matches]
    tokens = [normalize_skill_name(token) for token in raw_tokens]
    if not tokens:
        return []

    values = []
    unknown = []
    index = 0
    while index < len(tokens):
        match = None
        match_length = 0
        for end in range(len(tokens), index, -1):
            candidate = tuple(tokens[index:end])
            if candidate in known:
                raw_start = token_matches[index].start()
                raw_end = token_matches[end - 1].end()
                # Do not extract a known skill from a larger hyphenated label
                # such as "Pandas-like" or "not-Python".
                if ((raw_start > 0 and chunk[raw_start - 1] == "-")
                        or (raw_end < len(chunk) and chunk[raw_end] == "-")):
                    continue
                match = known[candidate]
                match_length = end - index
                break
        if match is None:
            unknown.append(raw_tokens[index])
            index += 1
            continue
        if unknown:
            unknown_value = " ".join(unknown)
            if unknown_value not in _IGNORED_LABELS:
                values.append(unknown_value)
            unknown = []
        values.append(match)
        index += match_length
    if unknown:
        unknown_value = " ".join(unknown)
        if unknown_value not in _IGNORED_LABELS:
            values.append(unknown_value)
    return values


def split_skill_values(value, skill_catalog=None):
    """Parse skill strings, collections, and DB-like name records into distinct skills.

    Known skill names are greedily segmented, so ``Python Pandas NumPy`` becomes
    three entries while multiword names such as ``Machine Learning`` stay intact.
    """
    known = _known_skill_trie(skill_catalog)
    parsed = []
    for chunk in _simple_chunks(value):
        parsed.extend(_parse_chunk(chunk, known))
    unique = []
    seen = set()
    for raw in parsed:
        key = resolve_skill_key(raw)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(canonical_skill_name(raw))
    return unique


def match_skill_lists(student_skills, required_skills, skill_catalog=None):
    """Match exact canonical skill keys and report the required-skill percentage."""
    required = split_skill_values(required_skills, skill_catalog)
    student_catalog = [*required, *_simple_chunks(skill_catalog)]
    student = split_skill_values(student_skills, student_catalog)
    student_keys = {resolve_skill_key(skill) for skill in student}
    matched = [skill for skill in required if resolve_skill_key(skill) in student_keys]
    matched_keys = {resolve_skill_key(skill) for skill in matched}
    missing = [skill for skill in required if resolve_skill_key(skill) not in matched_keys]
    total = len(required)
    percentage = round(100 * len(matched) / total) if total else 0
    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "total_required_skills": total,
        "match_percentage": percentage,
    }


def skill_name_variants(value):
    """Return explicit spelling variants for safe text extraction of one skill."""
    key = resolve_skill_key(value)
    variants = {str(value or "").strip()}
    variants.update(alias for alias, canonical in _ALIASES.items() if canonical == key)
    variants.update(name for name in BUILTIN_SKILLS if resolve_skill_key(name) == key)
    return sorted((variant for variant in variants if variant), key=lambda item: (-len(item), item.casefold()))


def skill_text_contains(text, skill):
    """Find an explicit skill mention in prose without substring or fuzzy matching."""
    source = str(text or "")
    for variant in skill_name_variants(skill):
        tokens = [normalize_skill_name(token) for token in _TOKEN.findall(variant)]
        if not tokens:
            continue
        phrase = r"[\s\-_.]+".join(re.escape(token) for token in tokens)
        if re.search(r"(?<![a-z0-9-])" + phrase + r"(?![a-z0-9-])", source, re.I):
            return True
    return False
