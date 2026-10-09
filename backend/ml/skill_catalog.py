"""Curated 100-skill vocabulary used to fit the content-based recommender."""


# Context terms give the catalog model useful career and domain language while
# keeping every skill recommendation traceable to a curated skill entry.
_SKILL_GROUPS = {
    "Programming and computer science": {
        "context": "software developer programming coding algorithms application engineering logic computer science",
        "skills": (
            "Python", "Java", "C", "C++", "C#", "JavaScript", "TypeScript", "PHP", "Ruby", "Go",
            "Kotlin", "Swift", "Data Structures", "Problem Solving", "Aptitude",
        ),
    },
    "Frontend and web": {
        "context": "frontend web browser user interface client side websites accessible responsive interface design",
        "skills": (
            "HTML", "CSS", "React", "Angular", "Vue.js", "DOM Manipulation", "Responsive Design",
            "Web Accessibility", "UX/UI Design", "Web Development",
        ),
    },
    "Backend and APIs": {
        "context": "backend server services application programming interface web service distributed architecture",
        "skills": (
            "Flask", "Django", "Node.js", "REST APIs", "GraphQL", "Microservices", "API Design",
            "Spring Boot", "Express.js",
        ),
    },
    "Data and analytics": {
        "context": "data analyst analytics business intelligence reporting visualization data pipeline insights",
        "skills": (
            "Data Science", "Data Analytics", "Pandas", "NumPy", "Excel", "Statistics", "Power BI",
            "Tableau", "PowerPoint", "Jupyter", "Apache Spark", "ETL",
        ),
    },
    "Artificial intelligence and machine learning": {
        "context": "artificial intelligence ai machine learning predictive modeling deep neural language vision model deployment",
        "skills": (
            "Machine Learning", "Scikit-learn", "TensorFlow", "PyTorch", "Deep Learning", "NLP",
            "Computer Vision", "Generative AI", "Prompt Engineering", "MLOps",
        ),
    },
    "Databases and data platforms": {
        "context": "database relational nosql query data storage schema administration transactions optimization",
        "skills": (
            "SQL", "MongoDB", "MySQL", "PostgreSQL", "Redis", "Oracle Database", "Microsoft SQL Server",
            "SQLite", "Database Design", "Data Modeling", "Query Optimization",
        ),
    },
    "Cloud and DevOps": {
        "context": "cloud infrastructure platform operations automation deployment reliability containers source control",
        "skills": (
            "AWS", "Azure", "Docker", "Linux", "Git", "Google Cloud", "Kubernetes", "CI/CD", "Terraform",
        ),
    },
    "Quality and security": {
        "context": "quality assurance software testing test automation security application protection reliability debugging",
        "skills": (
            "Software Testing", "Selenium", "Pytest", "Cypress", "Test Automation", "Cybersecurity", "OWASP",
            "Secure Coding", "Load Testing", "Debugging",
        ),
    },
    "Engineering tools and systems": {
        "context": "engineering electrical electronics mechanical design simulation embedded hardware circuits manufacturing",
        "skills": ("MATLAB", "Simulink", "AutoCAD", "SolidWorks", "Embedded Systems", "Circuit Design"),
    },
    "Professional skills": {
        "context": "workplace collaboration communication leadership documentation teamwork planning delivery critical thinking",
        "skills": (
            "Communication", "Communication Skills", "Teamwork", "Leadership", "Technical Writing", "Agile",
            "Project Management", "Critical Thinking",
        ),
    },
}


SKILL_CATALOG = tuple(
    {
        "name": name,
        "category": category,
        "context": details["context"],
        "document": f"{name} {category} {details['context']}",
    }
    for category, details in _SKILL_GROUPS.items()
    for name in details["skills"]
)

SKILL_NAMES = tuple(item["name"] for item in SKILL_CATALOG)
SKILL_METADATA = {item["name"].casefold(): item for item in SKILL_CATALOG}

if len(SKILL_CATALOG) != 100 or len({name.casefold() for name in SKILL_NAMES}) != 100:
    raise RuntimeError("The skill recommender catalog must contain exactly 100 distinct skills.")
