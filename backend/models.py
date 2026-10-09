from datetime import date, datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(24), nullable=False, index=True)
    phone = db.Column(db.String(40))
    date_of_birth = db.Column(db.Date)
    active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class PasswordResetGrant(db.Model):
    __tablename__ = "password_reset_challenges"
    id = db.Column(db.Integer, primary_key=True)
    # Keep the legacy table and column names for existing installations.
    token_hash = db.Column("email_hash", db.String(64), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime)
    verified_at = db.Column(db.DateTime)


class PasswordRecoveryAttempt(db.Model):
    __tablename__ = "password_recovery_attempts"
    id = db.Column(db.Integer, primary_key=True)
    client_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    window_started_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    blocked_until = db.Column(db.DateTime)


class CompanyPasswordResetOTP(db.Model):
    __tablename__ = "company_password_reset_otps"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    otp_hash = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)


class Branch(db.Model):
    __tablename__ = "branches"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)


class Student(db.Model):
    __tablename__ = "students"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    college_name = db.Column(db.String(180), nullable=False, default="")
    student_number = db.Column(db.String(40), unique=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"))
    year = db.Column(db.Integer, default=4)
    semester = db.Column(db.Integer, default=8)
    graduation_year = db.Column(db.Integer)
    gender = db.Column(db.String(40), nullable=False, default="")
    courses = db.Column(db.Text, nullable=False, default="[]")
    achievements = db.Column(db.Text, nullable=False, default="[]")
    interest_tags = db.Column(db.Text, nullable=False, default="[]")
    cgpa = db.Column(db.Float, default=0)
    attendance = db.Column(db.Float, default=0)
    career_goal = db.Column(db.String(180), default="Software Engineer")
    interests = db.Column(db.Text, nullable=False, default="")
    bio = db.Column(db.Text, default="")
    resume_filename = db.Column(db.String(255))


class Company(db.Model):
    __tablename__ = "companies"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    company_name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, default="")
    industry = db.Column(db.String(100), default="Technology")
    website = db.Column(db.String(255), default="")
    location = db.Column(db.String(120), default="")
    recruiter_name = db.Column(db.String(120), default="")


class PlacementOfficer(db.Model):
    __tablename__ = "placement_officers"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department = db.Column(db.String(120), default="Placement Cell")


class Skill(db.Model):
    __tablename__ = "skills"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    category = db.Column(db.String(80), default="Technical")


class StudentSkill(db.Model):
    __tablename__ = "student_skills"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = db.Column(db.Integer, db.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency = db.Column(db.Integer, default=60)
    __table_args__ = (db.UniqueConstraint("student_id", "skill_id"),)


class Job(db.Model):
    __tablename__ = "jobs"
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, default="")
    minimum_cgpa = db.Column(db.Float, default=0)
    minimum_attendance = db.Column(db.Float, default=0)
    eligible_branches = db.Column(db.Text, default="[]")
    experience = db.Column(db.String(100), default="Fresher")
    certifications = db.Column(db.Text, default="[]")
    salary = db.Column(db.String(80), default="Not disclosed")
    location = db.Column(db.String(120), default="")
    vacancies = db.Column(db.Integer, default=1)
    deadline = db.Column(db.Date)
    terms = db.Column(db.Text, default="")
    active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class JobSkill(db.Model):
    __tablename__ = "job_skills"
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = db.Column(db.Integer, db.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required = db.Column(db.Boolean, default=True)
    __table_args__ = (db.UniqueConstraint("job_id", "skill_id"),)


class Application(db.Model):
    __tablename__ = "applications"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = db.Column(db.Integer, db.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(db.String(32), default="Applied", nullable=False)
    match_score = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("student_id", "job_id"),)


class Project(db.Model):
    __tablename__ = "projects"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, default="")
    technologies = db.Column(db.Text, default="[]")
    github_url = db.Column(db.String(500), default="")
    demo_url = db.Column(db.String(500), default="")
    status = db.Column(db.String(24), default="Pending")


class Internship(db.Model):
    __tablename__ = "internships"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    company = db.Column(db.String(160), nullable=False)
    role = db.Column(db.String(160), default="Intern")
    duration = db.Column(db.String(80), default="")
    description = db.Column(db.Text, default="")
    certificate_url = db.Column(db.String(500), default="")
    status = db.Column(db.String(24), default="Pending")


class Certificate(db.Model):
    __tablename__ = "certificates"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(180), nullable=False)
    certificate_type = db.Column(db.String(60), default="Other")
    certificate_id = db.Column(db.String(120), default="")
    issuer = db.Column(db.String(160), default="")
    completion_date = db.Column(db.Date)
    url = db.Column(db.String(500), default="")
    status = db.Column(db.String(32), default="REQUIRES_REVIEW")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class NptelCertificate(db.Model):
    __tablename__ = "nptel_certificates"
    id = db.Column(db.Integer, primary_key=True)
    certificate_id = db.Column(db.Integer, db.ForeignKey("certificates.id", ondelete="CASCADE"), nullable=False, unique=True)
    course_name = db.Column(db.String(180), nullable=False)
    score = db.Column(db.Float)


class Quiz(db.Model):
    __tablename__ = "quizzes"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    category = db.Column(db.String(100), nullable=False, index=True)
    duration_minutes = db.Column(db.Integer, default=10)
    active = db.Column(db.Boolean, default=True)


class QuizQuestion(db.Model):
    __tablename__ = "quiz_questions"
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, nullable=False)
    answer_index = db.Column(db.Integer, nullable=False)
    explanation = db.Column(db.Text, default="")
    difficulty = db.Column(db.String(16), nullable=False, default="Medium")
    topic = db.Column(db.String(120), default="")
    question_type = db.Column(db.String(24), nullable=False, default="MCQ")
    answer_indices = db.Column(db.Text, default="[]")


class QuizResult(db.Model):
    __tablename__ = "quiz_results"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    score = db.Column(db.Float, nullable=False)
    correct_count = db.Column(db.Integer, default=0)
    weak_areas = db.Column(db.Text, default="[]")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class QuickQuizAttempt(db.Model):
    """One authenticated student's AI Quick Quiz reservation per local calendar day."""
    __tablename__ = "quick_quiz_attempts"
    __table_args__ = (
        db.UniqueConstraint("user_id", "attempt_date", name="uq_quick_quiz_user_date"),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id", ondelete="SET NULL"))
    attempt_date = db.Column(db.Date, nullable=False, index=True)
    attempt_id = db.Column(db.String(64), nullable=False, unique=True, index=True)
    status = db.Column(db.String(16), nullable=False, default="GENERATING", index=True)
    category = db.Column(db.String(100), nullable=False)
    topic = db.Column(db.String(120), default="", nullable=False)
    difficulty = db.Column(db.String(16), nullable=False)
    requested_difficulty = db.Column(db.String(16), nullable=False)
    question_count = db.Column(db.Integer, nullable=False)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quizzes.id", ondelete="SET NULL"))
    question_ids = db.Column(db.Text, nullable=False, default="[]")
    answers = db.Column(db.Text, nullable=False, default="{}")
    answers_revision = db.Column(db.Integer, nullable=False, default=0)
    score = db.Column(db.Float)
    correct_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)


class Interview(db.Model):
    __tablename__ = "interviews"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    category = db.Column(db.String(80), default="General")
    status = db.Column(db.String(24), default="In Progress")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class InterviewQuestion(db.Model):
    __tablename__ = "interview_questions"
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(80), nullable=False, index=True)
    prompt = db.Column(db.Text, nullable=False)
    expected_keywords = db.Column(db.Text, default="[]")


class InterviewResult(db.Model):
    __tablename__ = "interview_results"
    id = db.Column(db.Integer, primary_key=True)
    interview_id = db.Column(db.Integer, db.ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = db.Column(db.Integer, db.ForeignKey("interview_questions.id"))
    answer = db.Column(db.Text, default="")
    relevance_score = db.Column(db.Float, default=0)
    communication_score = db.Column(db.Float, default=0)
    feedback = db.Column(db.Text, default="")


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    message = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(255), default="")
    read = db.Column(db.Boolean, default=False)
    dedupe_key = db.Column(db.String(180), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Course(db.Model):
    __tablename__ = "courses"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    skill = db.Column(db.String(100), nullable=False, index=True)
    level = db.Column(db.String(40), default="Beginner")
    url = db.Column(db.String(500), default="")
    duration = db.Column(db.String(60), default="Self-paced")


class StudentProgress(db.Model):
    __tablename__ = "student_progress"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = db.Column(db.String(40), nullable=False)
    item_name = db.Column(db.String(180), nullable=False)
    progress = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Placement(db.Model):
    __tablename__ = "placements"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id", ondelete="SET NULL"))
    job_id = db.Column(db.Integer, db.ForeignKey("jobs.id", ondelete="SET NULL"))
    package_lpa = db.Column(db.Float, default=0)
    placement_date = db.Column(db.Date)


class CalendarEvent(db.Model):
    __tablename__ = "calendar_events"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(180), nullable=False)
    event_type = db.Column(db.String(50), default="Training")
    starts_at = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text, default="")


class Feedback(db.Model):
    __tablename__ = "feedback"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    rating = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(60), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ResumeAnalysis(db.Model):
    __tablename__ = "resume_analyses"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    score = db.Column(db.Float, default=0)
    result_json = db.Column(db.Text, default="{}")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
