"""Transparent hybrid skill recommendations using profile and demand signals."""

import math
import re

from ml.skills import resolve_skill_key, split_skill_values

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    TfidfVectorizer = cosine_similarity = None


_ROLE_SKILL_GROUPS = (
    (("data analyst", "business analyst", "product analyst", "data analytics", "business intelligence", "analytics", "data visualization"),
     {"python", "sql", "power bi", "excel", "statistics", "pandas"}),
    (("data scientist", "machine learning", "ml engineer", "ai engineer", "artificial intelligence"),
     {"python", "sql", "machine learning", "pandas", "numpy", "statistics", "scikit-learn", "tensorflow"}),
    (("software engineer", "software developer", "backend developer", "full stack", "web developer", "frontend developer", "python developer", "java developer"),
     {"python", "java", "sql", "data structures", "javascript", "git", "flask", "react"}),
    (("database", "sql developer", "data engineer", "database administrator"),
     {"sql", "mysql", "python", "pandas", "aws"}),
    (("cloud engineer", "cloud associate", "devops", "site reliability"),
     {"aws", "docker", "linux", "python", "git"}),
    (("embedded systems", "firmware", "electronics engineer"),
     {"c", "c++", "python", "linux"}),
)

_BRANCH_SKILLS = {
    "cse": {"python", "sql", "java", "data structures", "javascript", "git", "web development"},
    "it": {"python", "sql", "java", "data structures", "javascript", "git", "web development"},
    "ai": {"python", "sql", "machine learning", "pandas", "numpy", "statistics", "data structures"},
    "data": {"python", "sql", "machine learning", "pandas", "numpy", "statistics", "power bi"},
    "ece": {"c", "c++", "python", "linux"},
    "eee": {"c", "c++", "python", "linux"},
    "mechanical": {"python", "excel", "statistics"},
    "civil": {"python", "excel", "statistics"},
}

_SKILL_NEIGHBORS = {
    "python": {"sql": .55, "pandas": .75, "numpy": .7, "machine learning": .6, "flask": .75, "data structures": .4},
    "sql": {"python": .5, "mysql": .75, "power bi": .65, "excel": .55, "pandas": .35},
    "excel": {"sql": .7, "power bi": .75, "python": .45, "statistics": .4},
    "javascript": {"react": .75, "web development": .8, "sql": .25, "git": .4},
    "java": {"data structures": .75, "sql": .4, "git": .4},
    "data structures": {"python": .45, "java": .65, "c++": .55},
    "machine learning": {"python": .85, "pandas": .7, "numpy": .7, "statistics": .65, "sql": .35},
    "power bi": {"sql": .7, "excel": .75, "statistics": .4, "python": .35},
}


def _terms(value):
    return {term for term in re.findall(r"[a-z0-9+#]+", str(value or "").casefold()) if len(term) > 1}


def _normalized(value):
    return re.sub(r"[^a-z0-9+#]+", " ", str(value or "").casefold()).strip()


def _skill_key(value):
    return resolve_skill_key(value)


def _values(value):
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[,;\n]+", value) if part.strip()]
    if isinstance(value, (list, tuple, set)):
        return [str(part).strip() for part in value if str(part).strip()]
    return []


def _skill_values(value):
    return split_skill_values(value)


def _has_phrase(text, phrase):
    text = f" {_normalized(text)} "
    phrase = f" {_normalized(phrase)} "
    return phrase.strip() and phrase in text


def _text_fit(skill, text):
    if _has_phrase(text, skill):
        return 1.0
    skill_terms = _terms(skill)
    text_terms = _terms(text)
    # A single shared generic word (for example "data" in "Data Analyst")
    # is not enough evidence to recommend a multiword skill like Data Structures.
    return 1.0 if skill_terms and skill_terms.issubset(text_terms) else 0.0


def _domain_skills(text):
    matched = set()
    for triggers, skills in _ROLE_SKILL_GROUPS:
        if any(_has_phrase(text, trigger) for trigger in triggers):
            matched.update(_skill_key(skill) for skill in skills)
    return matched


def _branch_skills(branch):
    normalized = _normalized(branch)
    matched = set()
    for marker, skills in _BRANCH_SKILLS.items():
        if _has_phrase(normalized, marker):
            matched.update(_skill_key(skill) for skill in skills)
    return matched


def _dedupe_candidates(candidates):
    unique = {}
    for raw in candidates:
        candidate = dict(raw)
        name = str(candidate.get("skill", "")).strip()
        key = _skill_key(name)
        if not key:
            continue
        candidate["skill"] = name
        candidate["vacancies"] = max(0, int(candidate.get("vacancies", 0) or 0))
        candidate["resource_titles"] = list(dict.fromkeys(candidate.get("resource_titles", []) or []))
        candidate["resources"] = list(candidate.get("resources", []) or [])
        if key not in unique:
            unique[key] = candidate
            continue
        current = unique[key]
        current["vacancies"] = max(current["vacancies"], candidate["vacancies"])
        current["resource_titles"] = list(dict.fromkeys(current["resource_titles"] + candidate["resource_titles"]))
        seen_resources = {(item.get("title"), item.get("url")) for item in current["resources"]}
        current["resources"].extend(
            item for item in candidate["resources"]
            if (item.get("title"), item.get("url")) not in seen_resources
        )
    return list(unique.values())


def rank_skill_candidates(context, candidates):
    """Rank only distinct catalog skills with evidence from this student's profile."""
    candidates = _dedupe_candidates(candidates)
    if not candidates:
        return [], "profile_and_demand_rules"

    skills = _skill_values(context.get("skills", []))
    interests = _values(context.get("interests", []))
    goals = _values(context.get("career_goal", ""))
    project_technologies = _skill_values(context.get("project_technologies", []))
    weak_topics = _values(context.get("weak_quiz_topics", []))
    learning_progress = _skill_values(context.get("learning_progress", []))
    context_parts = [context.get("branch", ""), *goals, *interests, *skills,
                     *project_technologies, *weak_topics, *learning_progress]
    query = " ".join(str(part) for part in context_parts if part)
    documents = [" ".join([candidate["skill"], " ".join(candidate["resource_titles"])]) for candidate in candidates]
    similarity = [0.0] * len(candidates)
    method = "profile_interest_goal_and_demand_rules"
    if TfidfVectorizer and query.strip():
        try:
            matrix = TfidfVectorizer(ngram_range=(1, 2), stop_words="english").fit_transform([query] + documents)
            similarity = cosine_similarity(matrix[0:1], matrix[1:]).ravel().tolist()
            method = "tfidf_profile_interest_goal_and_demand_rules"
        except ValueError:
            pass

    owned = {_skill_key(value) for value in skills}
    in_progress = {_skill_key(value) for value in learning_progress}
    goal_text = " ".join(goals)
    interest_text = " ".join(interests)
    goal_domains = _domain_skills(goal_text)
    interest_domains = _domain_skills(interest_text)
    branch_domains = _branch_skills(context.get("branch", ""))
    owned_keys = {_skill_key(value) for value in skills}
    max_demand = max((candidate["vacancies"] for candidate in candidates), default=0) or 1
    ranked = []

    for index, candidate in enumerate(candidates):
        skill = candidate["skill"]
        key = _skill_key(skill)
        if key in owned or key in in_progress:
            continue

        career_match = max(_text_fit(skill, goal_text), float(key in goal_domains))
        interest_match = max(_text_fit(skill, interest_text), float(key in interest_domains))
        skill_affinity = max(
            (_SKILL_NEIGHBORS.get(owned_skill, {}).get(key, 0.0) for owned_skill in owned_keys),
            default=0.0,
        )
        skill_terms = _terms(skill)
        topic_match = max(
            (ratio if ratio >= .75 else 0.0 for ratio in (
                len(skill_terms & _terms(topic)) / max(1, len(skill_terms)) for topic in weak_topics
            )),
            default=0.0,
        )
        branch_match = float(key in branch_domains)
        similarity_score = max(0.0, min(1.0, float(similarity[index])))
        profile_relevance = max(
            career_match, interest_match, skill_affinity, topic_match,
            similarity_score if similarity_score >= .22 else 0.0,
        )
        has_profile_evidence = bool(
            goal_text.strip() or interest_text.strip() or owned_keys or weak_topics
            or project_technologies or learning_progress
        )
        # Branch is a useful fallback for sparse profiles, but shouldn't override
        # a stated goal or interest and add unrelated branch-only skills.
        if profile_relevance < .12 and (has_profile_evidence or not branch_match):
            continue

        demand_score = math.log1p(candidate["vacancies"]) / math.log1p(max_demand)
        score = round(100 * (
            .26 * career_match + .25 * interest_match + .17 * skill_affinity +
            .12 * topic_match + .10 * branch_match + .07 * similarity_score + .03 * demand_score
        ))
        reasons = []
        if career_match >= .5 and goal_text:
            reasons.append(f"Supports your career goal: {goal_text}")
        if interest_match >= .5 and interest_text:
            reasons.append("Matches your stated interests")
        if skill_affinity >= .3:
            reasons.append("Builds on skills you already have")
        if topic_match >= .25:
            reasons.append("Connects to a topic that needs more quiz practice")
        if branch_match:
            reasons.append(f"Relevant to {context.get('branch')} study paths")
        if similarity_score >= .1:
            reasons.append("Related to your profile evidence and learning activity")
        if candidate["vacancies"]:
            reasons.append(f"Required by {candidate['vacancies']} active job vacancies")

        ranked.append({
            **candidate,
            "recommendation_score": score,
            "career_goal_match": round(career_match, 3),
            "interest_match": round(interest_match, 3),
            "skill_affinity": round(skill_affinity, 3),
            "content_similarity": round(similarity_score, 3),
            "quiz_topic_match": round(topic_match, 3),
            "reason": "; ".join(reasons),
        })

    ranked.sort(key=lambda item: (item["recommendation_score"], item["vacancies"], item["skill"].casefold()), reverse=True)
    return ranked, method
