"""Career skill paths and transparent, proficiency-aware recommendations."""

from .skills import resolve_skill_key

CAREER_PATHS = {
    "frontend_developer": {
        "title": "Frontend Developer",
        "subtitle": "Build accessible, responsive interfaces for the web.",
        "icon": "◫",
        "certifications": [{
            "title": "Meta Front-End Developer Professional Certificate",
            "kind": "Professional certificate",
            "url": "https://www.coursera.org/professional-certificates/meta-front-end-developer",
        }],
        "skills": [
            {"name": "HTML", "target": 65, "weight": 1.0, "priority": "MEDIUM", "description": "Structure web pages with semantic, accessible markup.", "project": "Create a semantic portfolio page with a contact form.", "resources": [{"title": "MDN: HTML", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content"}]},
            {"name": "CSS", "target": 65, "weight": 1.0, "priority": "MEDIUM", "description": "Style interfaces with reusable layout and visual rules.", "project": "Build a responsive profile page using Grid and Flexbox.", "resources": [{"title": "MDN: CSS styling basics", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics"}]},
            {"name": "JavaScript", "target": 70, "weight": 1.4, "priority": "HIGH", "description": "Add interaction, state, and browser behavior to web pages.", "project": "Build a searchable task list with saved browser state.", "resources": [{"title": "MDN: JavaScript fundamentals", "kind": "Course", "url": "https://developer.mozilla.org/en-US/docs/Learn/JavaScript"}, {"title": "Meta: Programming with JavaScript", "kind": "Course", "url": "https://www.coursera.org/professional-certificates/meta-front-end-developer"}]},
            {"name": "DOM Manipulation", "target": 60, "weight": 1.2, "priority": "HIGH", "description": "Use browser APIs to update page content in response to user actions.", "project": "Create an interactive quiz that updates the page without reloading.", "resources": [{"title": "MDN: DOM scripting", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/DOM_scripting"}]},
            {"name": "React", "target": 65, "weight": 1.3, "priority": "HIGH", "description": "Compose interactive interfaces from reusable components.", "project": "Build a small dashboard with reusable cards and API-backed data.", "resources": [{"title": "React: Quick Start", "kind": "Tutorial", "url": "https://react.dev/learn"}]},
            {"name": "Git", "target": 55, "weight": 0.8, "priority": "MEDIUM", "description": "Track changes and collaborate through Git and GitHub workflows.", "project": "Publish one project with a clear README and a feature branch.", "resources": [{"title": "Pro Git: Getting Started", "kind": "Course", "url": "https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control"}]},
            {"name": "Responsive Design", "target": 60, "weight": 0.8, "priority": "MEDIUM", "description": "Adapt layouts and content to different screen sizes.", "project": "Make your portfolio work well at mobile, tablet, and desktop widths.", "resources": [{"title": "MDN: Responsive design", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design"}]},
            {"name": "TypeScript", "target": 55, "weight": 0.7, "priority": "LOW", "description": "Add static types that make larger JavaScript applications easier to maintain.", "project": "Convert one JavaScript form flow to typed TypeScript.", "resources": [{"title": "TypeScript: The Basics", "kind": "Tutorial", "url": "https://www.typescriptlang.org/docs/handbook/2/basic-types.html"}]},
        ],
    },
    "backend_developer": {
        "title": "Backend Developer",
        "subtitle": "Design APIs, data models, and reliable server-side services.",
        "icon": "⌘",
        "certifications": [{"title": "AWS Certified Developer – Associate", "kind": "Certification", "url": "https://aws.amazon.com/certification/certified-developer-associate/"}],
        "skills": [
            {"name": "Python", "target": 65, "weight": 1.2, "priority": "HIGH", "description": "Write clear programs, work with data, and build server-side logic.", "project": "Create a command-line tracker that reads and writes structured data.", "resources": [{"title": "The Python Tutorial", "kind": "Tutorial", "url": "https://docs.python.org/3/tutorial/"}]},
            {"name": "SQL", "target": 65, "weight": 1.2, "priority": "HIGH", "description": "Query relational data and shape it for application workflows.", "project": "Design a small relational schema and implement CRUD queries.", "resources": [{"title": "PostgreSQL: SQL tutorial", "kind": "Tutorial", "url": "https://www.postgresql.org/docs/current/tutorial-sql.html"}]},
            {"name": "REST APIs", "target": 65, "weight": 1.3, "priority": "HIGH", "description": "Design predictable HTTP endpoints, status codes, and JSON contracts.", "project": "Build a documented API with validation and consistent error responses.", "resources": [{"title": "MDN: HTTP overview", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"}]},
            {"name": "Git", "target": 55, "weight": 0.7, "priority": "MEDIUM", "description": "Track changes and collaborate through Git and GitHub workflows.", "project": "Publish an API project with a README and a feature branch.", "resources": [{"title": "Pro Git: Getting Started", "kind": "Course", "url": "https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control"}]},
            {"name": "PostgreSQL", "target": 55, "weight": 0.9, "priority": "MEDIUM", "description": "Model relational data and manage it with a production-grade database.", "project": "Add indexes and relationships to a student project database.", "resources": [{"title": "PostgreSQL: Tutorial", "kind": "Course", "url": "https://www.postgresql.org/docs/current/tutorial.html"}]},
            {"name": "Flask", "target": 55, "weight": 0.9, "priority": "MEDIUM", "description": "Build Python web applications and APIs with a small, flexible framework.", "project": "Add authentication and CRUD routes to a Flask service.", "resources": [{"title": "Flask: Application tutorial", "kind": "Tutorial", "url": "https://flask.palletsprojects.com/en/stable/tutorial/"}]},
            {"name": "Docker", "target": 45, "weight": 0.6, "priority": "LOW", "description": "Package services and dependencies in repeatable containers.", "project": "Containerize your API and database setup for local development.", "resources": [{"title": "Docker: Get started", "kind": "Course", "url": "https://docs.docker.com/get-started/"}]},
        ],
    },
    "full_stack_developer": {
        "title": "Full-Stack Developer",
        "subtitle": "Connect polished frontends to complete backend services.",
        "icon": "◈",
        "certifications": [{"title": "Meta Front-End Developer Professional Certificate", "kind": "Professional certificate", "url": "https://www.coursera.org/professional-certificates/meta-front-end-developer"}],
        "skills": [
            {"name": "HTML", "target": 60, "weight": 0.7, "priority": "MEDIUM", "description": "Structure web pages with semantic, accessible markup.", "project": "Build the accessible shell for a portfolio application.", "resources": [{"title": "MDN: HTML", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content"}]},
            {"name": "CSS", "target": 60, "weight": 0.8, "priority": "MEDIUM", "description": "Style interfaces with reusable layout and visual rules.", "project": "Create a responsive dashboard layout using Grid and Flexbox.", "resources": [{"title": "MDN: CSS styling basics", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics"}]},
            {"name": "JavaScript", "target": 65, "weight": 1.2, "priority": "HIGH", "description": "Use one language across browser interactions and server-side tooling.", "project": "Build a client that validates forms and consumes a JSON API.", "resources": [{"title": "MDN: JavaScript fundamentals", "kind": "Course", "url": "https://developer.mozilla.org/en-US/docs/Learn/JavaScript"}]},
            {"name": "React", "target": 60, "weight": 1.0, "priority": "HIGH", "description": "Compose interactive interfaces from reusable components.", "project": "Build a client dashboard that consumes your own API.", "resources": [{"title": "React: Quick Start", "kind": "Tutorial", "url": "https://react.dev/learn"}]},
            {"name": "Python", "target": 60, "weight": 1.0, "priority": "HIGH", "description": "Write server-side logic and data-processing code.", "project": "Create backend routes for a small campus service.", "resources": [{"title": "The Python Tutorial", "kind": "Tutorial", "url": "https://docs.python.org/3/tutorial/"}]},
            {"name": "REST APIs", "target": 60, "weight": 1.1, "priority": "HIGH", "description": "Connect the browser and server through clear HTTP interfaces.", "project": "Build and document a JSON API consumed by your frontend.", "resources": [{"title": "MDN: HTTP overview", "kind": "Tutorial", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"}]},
            {"name": "SQL", "target": 55, "weight": 0.9, "priority": "MEDIUM", "description": "Store and query application data in relational tables.", "project": "Persist users and project records with relational queries.", "resources": [{"title": "PostgreSQL: SQL tutorial", "kind": "Tutorial", "url": "https://www.postgresql.org/docs/current/tutorial-sql.html"}]},
            {"name": "Git", "target": 55, "weight": 0.7, "priority": "MEDIUM", "description": "Track changes and collaborate through Git and GitHub workflows.", "project": "Publish your full-stack capstone with setup and API instructions.", "resources": [{"title": "Pro Git: Getting Started", "kind": "Course", "url": "https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control"}]},
        ],
    },
    "data_analyst": {
        "title": "Data Analyst",
        "subtitle": "Turn reliable data into clear findings and decisions.",
        "icon": "▥",
        "certifications": [{"title": "Microsoft Certified: Power BI Data Analyst Associate (PL-300)", "kind": "Certification", "url": "https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/"}, {"title": "Google Data Analytics Professional Certificate", "kind": "Professional certificate", "url": "https://grow.google/certificates/data-analytics/"}],
        "skills": [
            {"name": "Excel", "target": 65, "weight": 0.9, "priority": "HIGH", "description": "Clean, summarize, and inspect tabular data with spreadsheets.", "project": "Create a pivot-table report from a public dataset.", "resources": [{"title": "Microsoft: Excel training", "kind": "Course", "url": "https://support.microsoft.com/en-us/excel"}]},
            {"name": "SQL", "target": 65, "weight": 1.3, "priority": "HIGH", "description": "Retrieve and summarize records using joins, filters, and aggregates.", "project": "Answer five business questions with SQL over a public dataset.", "resources": [{"title": "PostgreSQL: SQL tutorial", "kind": "Tutorial", "url": "https://www.postgresql.org/docs/current/tutorial-sql.html"}]},
            {"name": "Statistics", "target": 60, "weight": 1.0, "priority": "HIGH", "description": "Use descriptive statistics and uncertainty to interpret results.", "project": "Compare two groups and explain uncertainty in the result.", "resources": [{"title": "OpenStax: Introductory Statistics", "kind": "Course", "url": "https://openstax.org/details/books/introductory-statistics-2e"}]},
            {"name": "Python", "target": 55, "weight": 0.9, "priority": "MEDIUM", "description": "Automate cleaning and repeatable analysis workflows.", "project": "Clean a public CSV and summarize its quality and trends.", "resources": [{"title": "The Python Tutorial", "kind": "Tutorial", "url": "https://docs.python.org/3/tutorial/"}]},
            {"name": "Pandas", "target": 60, "weight": 1.0, "priority": "HIGH", "description": "Transform and explore tabular data with DataFrames.", "project": "Analyze a public dataset and publish a notebook with findings.", "resources": [{"title": "pandas: Getting started", "kind": "Course", "url": "https://pandas.pydata.org/docs/getting_started/index.html"}]},
            {"name": "Data Visualization", "target": 60, "weight": 0.9, "priority": "MEDIUM", "description": "Choose charts that make comparisons and trends easy to understand.", "project": "Create a one-page dashboard with three decision-focused charts.", "resources": [{"title": "Microsoft Learn: Power BI learning paths", "kind": "Course", "url": "https://learn.microsoft.com/en-us/training/powerplatform/power-bi/"}]},
            {"name": "Power BI", "target": 55, "weight": 0.8, "priority": "MEDIUM", "description": "Model data and build shareable reports in Power BI.", "project": "Publish an interactive report with a clean data model.", "resources": [{"title": "PL-300 certification and training", "kind": "Certification", "url": "https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/"}]},
        ],
    },
    "ai_engineer": {
        "title": "AI Engineer",
        "subtitle": "Build, evaluate, and deploy machine learning applications.",
        "icon": "✦",
        "certifications": [{"title": "AWS Certified AI Practitioner", "kind": "Certification", "url": "https://aws.amazon.com/certification/certified-ai-practitioner/"}],
        "skills": [
            {"name": "Python", "target": 70, "weight": 1.2, "priority": "HIGH", "description": "Build data pipelines, experiments, and AI application code.", "project": "Create a reproducible Python notebook with a clean data pipeline.", "resources": [{"title": "The Python Tutorial", "kind": "Tutorial", "url": "https://docs.python.org/3/tutorial/"}]},
            {"name": "Statistics", "target": 60, "weight": 0.9, "priority": "HIGH", "description": "Reason about distributions, evaluation, and uncertainty in model results.", "project": "Compare model results with a baseline and explain the trade-offs.", "resources": [{"title": "OpenStax: Introductory Statistics", "kind": "Course", "url": "https://openstax.org/details/books/introductory-statistics-2e"}]},
            {"name": "NumPy", "target": 60, "weight": 0.8, "priority": "MEDIUM", "description": "Work efficiently with arrays and numerical operations.", "project": "Implement data transformations with NumPy and compare to loops.", "resources": [{"title": "NumPy: Learn", "kind": "Tutorial", "url": "https://numpy.org/learn/"}]},
            {"name": "Pandas", "target": 55, "weight": 0.8, "priority": "MEDIUM", "description": "Inspect, clean, and transform structured datasets.", "project": "Build a repeatable preprocessing notebook for a public dataset.", "resources": [{"title": "pandas: Getting started", "kind": "Course", "url": "https://pandas.pydata.org/docs/getting_started/index.html"}]},
            {"name": "Machine Learning", "target": 65, "weight": 1.2, "priority": "HIGH", "description": "Train and evaluate models with sound validation practices.", "project": "Compare two baseline classifiers using held-out evaluation.", "resources": [{"title": "scikit-learn: Getting started", "kind": "Tutorial", "url": "https://scikit-learn.org/stable/getting_started.html"}]},
            {"name": "Scikit-learn", "target": 60, "weight": 1.0, "priority": "HIGH", "description": "Build reproducible machine learning pipelines and model evaluations.", "project": "Train a scikit-learn pipeline and document its limitations.", "resources": [{"title": "scikit-learn: Getting started", "kind": "Tutorial", "url": "https://scikit-learn.org/stable/getting_started.html"}]},
            {"name": "PyTorch", "target": 55, "weight": 0.9, "priority": "MEDIUM", "description": "Build and train neural networks with tensors and automatic differentiation.", "project": "Train a small neural network and report validation results.", "resources": [{"title": "PyTorch Tutorials", "kind": "Course", "url": "https://docs.pytorch.org/tutorials/"}]},
            {"name": "NLP", "target": 50, "weight": 0.7, "priority": "LOW", "description": "Prepare text data and build applications around language models.", "project": "Build a small text classifier and inspect its errors.", "resources": [{"title": "Hugging Face: LLM course", "kind": "Course", "url": "https://huggingface.co/learn/llm-course/chapter1/1"}]},
        ],
    },
}


def career_catalog():
    """Return the public, JSON-ready career selector data."""
    return [{"id": key, "title": value["title"], "subtitle": value["subtitle"], "icon": value["icon"]}
            for key, value in CAREER_PATHS.items()]


def proficiency_label(value):
    value = int(value or 0)
    if value >= 80:
        return "Advanced"
    if value >= 50:
        return "Intermediate"
    if value > 0:
        return "Beginner"
    return "Not added"


def recommend_career_skills(career_id, skills, progress_by_key=None):
    """Compare known proficiency with role targets and rank unmet skills."""
    career = CAREER_PATHS[career_id]
    progress_by_key = progress_by_key or {}
    current = {str(key): max(0, min(100, int(value or 0))) for key, value in skills.items()}
    css_level = current.get(resolve_skill_key("CSS"), 0)
    requirements = []
    missing = []
    gaps = []
    recommendations = []
    weighted_readiness = 0.0
    total_weight = 0.0

    for order, requirement in enumerate(career["skills"], start=1):
        key = resolve_skill_key(requirement["name"])
        value = current.get(key, 0)
        target = requirement["target"]
        ratio = min(value, target) / target if target else 1
        weighted_readiness += ratio * requirement["weight"]
        total_weight += requirement["weight"]
        status = progress_by_key.get(key, "Not Started")
        priority = requirement["priority"]
        if requirement["name"] == "Responsive Design":
            priority = "LOW" if css_level >= 70 else "MEDIUM"
        elif value > 0 and target - value >= 35:
            priority = "HIGH"
        item = {
            **requirement,
            "key": key,
            "order": order,
            "proficiency": value,
            "proficiency_label": proficiency_label(value),
            "target_label": proficiency_label(target),
            "gap": max(0, target - value),
            "progress": status,
            "priority": priority,
        }
        requirements.append(item)
        if value == 0:
            missing.append(item)
        if value < target:
            gaps.append(item)
            if status != "Completed":
                item["reason"] = (
                    f"Your {item['name']} proficiency is {value}%; build it toward the {target}% role target."
                    if value else f"{item['name']} is a stated requirement for {career['title']} and is not in your skills yet."
                )
                recommendations.append(item)

    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    recommendations.sort(key=lambda item: (
        0 if item["progress"] == "In Progress" else 1,
        priority_order[item["priority"]],
        item["order"],
    ))
    readiness = round(weighted_readiness / total_weight * 100) if total_weight else 0
    return {
        "required_skills": requirements,
        "missing_skills": missing,
        "skill_gaps": gaps,
        "recommendations": recommendations,
        "readiness": readiness,
        "certifications": career["certifications"],
    }
