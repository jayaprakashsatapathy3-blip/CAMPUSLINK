# CAMPUSLINK

**AI-Powered Campus-to-Corporate Placement Management & Analytics Platform**

CAMPUSLINK is a local-first placement application for students, company recruiters and placement officers. The browser client uses HTML, CSS, vanilla JavaScript and Chart.js. The API is a modular Flask application backed by SQLAlchemy. MySQL is supported; a SQLite default makes the demonstration quick to start. Resume parsing, skill matching, quiz scoring and interview scoring run in the backend; the placement assistant and the disclosed resume-specific AI review use Groq when configured.

## Features included

- Separate Student, Company / Recruiter and Placement Officer workspaces with password hashing and signed bearer sessions.
- Student profile, skill records, projects, internships, certificate submissions, resume uploads, preparation tracker, roadmap, events and feedback.
- PDF, DOCX, and legacy DOC text extraction with section analysis and role-specific skill matching. PDF parsing uses PyMuPDF; DOCX parsing uses `python-docx`; legacy DOC uses an installed Word/LibreOffice/antiword/catdoc converter.
- Explainable estimated job match using TF-IDF cosine similarity, required-skill overlap, and weighted CGPA, project, internship, certificate, attendance and quiz signals.
- Vacancy creation, eligibility screening by branch / CGPA / attendance, match ranking, candidate profile review, shortlisting and application status updates.
- Local vacancy-demand recommendations and learning resource catalogue.
- Career-specific Skill Recommendations for five developer and data paths, with proficiency-aware gaps, weighted readiness, curated official resources, saved progress, and a step-by-step roadmap.
- AI-generated Quick Quizzes across broad topics and custom subjects, one successful attempt per student per configured local calendar day, resumable answer progress, score history and post-submit explanations; curated full quiz banks remain available separately.
- Manual project, internship and certificate review. Certificate records begin as `REQUIRES_REVIEW`; the application never claims to authenticate a certificate by itself.
- Branch analytics, application funnel, package summary, company hiring activity and skill-demand filters.
- Placement readiness falls back to a transparent profile score for small cohorts and uses local logistic regression only after there are at least 40 current-year profiles and 15 examples in each placement class.
- Responsive single-page frontend, Chart.js visualizations with a simple chart fallback if the CDN is unavailable, search, feedback states and empty states.

## Windows quick start (SQLite demo)

Python 3.11 or newer is recommended. In PowerShell:

```powershell
cd C:\Users\ASUS\Documents\Codex\2026-10-06\files-pasted-by-the-user-build\outputs\CAMPUSLINK\backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python seed.py
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). Flask serves the frontend and API from the same local origin. The SQLite database is created at `backend/campuslink.db`; uploaded files go to `backend/uploads/`.

If PowerShell blocks activation, use the venv interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe seed.py
.\.venv\Scripts\python.exe app.py
```

## MySQL setup

Install and start MySQL 8. Create a database and a dedicated account with permission to create and update tables. For example, in the MySQL client:

```sql
CREATE DATABASE campuslink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'campuslink'@'localhost' IDENTIFIED BY 'use-a-strong-password';
GRANT ALL PRIVILEGES ON campuslink.* TO 'campuslink'@'localhost';
```

Then in the backend directory:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` and set a private secret plus your MySQL connection string:

```dotenv
CAMPUSLINK_SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=mysql+pymysql://campuslink:use-a-strong-password@localhost:3306/campuslink?charset=utf8mb4
MAX_UPLOAD_MB=10
UPLOAD_FOLDER=uploads
HOST=127.0.0.1
PORT=5000
FLASK_DEBUG=0
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail@gmail.com
SMTP_FROM_EMAIL=your_gmail@gmail.com
SMTP_PASSWORD=your_google_app_password
OPENROUTER_API_KEY=your_openrouter_api_key
QUIZ_MODEL=deepseek/deepseek-v4.1-flash
APP_TIMEZONE=Asia/Kolkata
```

The app loads this `backend/.env` file at startup. For the placement assistant, create a Groq API key and set `GROQ_API_KEY`; optionally set `GROQ_MODEL` to a model available to your Groq account. Quick Quiz uses a separate OpenRouter API key and `QUIZ_MODEL`; the currently listed DeepSeek V4.1 Flash model is `deepseek/deepseek-v4.1-flash` and requires an OpenRouter account with available credits. Keep keys in `backend/.env`; none are sent to the browser. `APP_TIMEZONE` controls the calendar date used for the once-per-day Quick Quiz allowance. Company password recovery uses Gmail SMTP; set `SMTP_USERNAME` and `SMTP_FROM_EMAIL` to the sending Gmail address and `SMTP_PASSWORD` to its Google App Password. Generate an App Password from Google Account security after enabling 2-Step Verification; do not use your regular Gmail password. Keep `.env` private. `python seed.py` creates missing SQLAlchemy tables and adds demonstration data. `backend/database/schema.sql` is also provided as a MySQL-readable schema reference. Avoid committing `.env`, the database file or uploaded documents.

## Password recovery

The Company login's Forgot Password link uses a 6-digit email OTP that expires in five minutes. Company OTPs are HMAC-hashed in the database, resend is limited to once per minute, and wrong attempts are capped. Students and Placement Officers continue to verify the first four name letters plus DOB; the Company flow does not ask for DOB. Recovery attempts are rate-limited by client IP. Successful verification creates a random one-use reset grant that expires after ten minutes. The grant is stored only as a SHA-256 hash and is deleted after the password is changed. Passwords continue to use the existing Werkzeug password hash. Company email recovery needs Gmail SMTP settings in `backend/.env`; if missing, the endpoint returns a setup message without checking whether an account exists.

## Demo accounts

All seeded demo accounts use the password **`Campuslink123!`**.

| Role | Email |
|---|---|
| Student | `student01@campuslink.demo` |
| Company recruiter | `recruiter1@campuslink.demo` |
| Placement officer | `admin@campuslink.demo` |

The seed script creates 50 student profiles (`student01` through `student50`), 10 recruiter/company accounts, 20 vacancies, 50 applications, projects, internships, certificates, placements, skills, courses, interview questions and 220 curated quiz questions, including subject banks for each configured engineering branch. It is safe to run the seed script again; existing primary demo records are reused.

The placement officer role is stored as `ADMIN` in the API. Public self-registration is limited to students and companies. Provision an officer with `python create_admin.py` (the script prompts for credentials), or use the seeded demo officer locally. Do not enable public administrator registration on an institutional deployment.

## Local intelligence and score explanation

The match result is labelled **Estimated Job Match**, never a probability of being hired. The score combines skill fit (50%), CGPA (15%), project evidence (10%), internship evidence (10%), certificate records (5%), attendance (5%) and quiz average (5%). TF-IDF cosine similarity contributes a small relevance adjustment inside the skill-fit component. Eligibility is a separate check against branch, CGPA and attendance requirements. Results include matched and missing skills, explicit reasons and improvement suggestions.

Placement readiness uses a local logistic-regression model only when the current year cohort includes at least 40 records and at least 15 placed and 15 not-yet-placed students. The student being scored is excluded from training. The model is evaluated with a stratified 75/25 holdout split and the student dashboard displays balanced accuracy and ROC-AUC when validation is available. The current schema stores student features as snapshots only at scoring time, not as historical pre-placement snapshots; this limitation is included with model estimates. Smaller cohorts use a transparent rule-based readiness estimate. Neither output is a guaranteed placement probability. The demonstration seed intentionally falls back to the transparent score because its placed sample is below the model threshold.

The demo defines the eligible placement cohort as fourth-year students; branch placement rate is placed students divided by fourth-year students. Update that rule in `backend/app.py` if the institution uses a different eligibility policy.

Resume analysis extracts text from PDF, DOCX and legacy DOC files, scans built-in and database skill catalogues, and identifies education, experience, projects, certifications and technical knowledge. It compares exact and partial evidence with a selected vacancy, pasted/uploaded job description, or the student's career goal, then reports missing and additional skills with a prioritized learning roadmap. Image-based PDF pages are OCR-processed with PyMuPDF when Tesseract OCR is installed on the backend host. Set `TESSDATA_PREFIX` in `backend/.env` to Tesseract's `tessdata` directory and set `RESUME_OCR_LANGUAGE` if needed; Tesseract is separate software and is not installed by Python requirements. Legacy DOC conversion requires Microsoft Word, LibreOffice, antiword or catdoc on the backend host. When the user submits a resume for its AI-specific review, email addresses and phone numbers are redacted before resume text and target requirements are sent to the configured Groq API; other resume content, including names, is sent for that review. Local parsing and matching remain available if Groq is unavailable. The Skill Recommendations page compares the student's listed skill proficiency with rule-based requirements for a selected career; role-specific resource links, recommendations and progress are saved per student in the existing database. The broader skill recommendation API also combines profile, interests, quiz and vacancy-demand signals. Intent routing uses local TF-IDF similarity with keyword fallback, normalizes common typos and abbreviations, and preserves context for short follow-up messages without retaining user queries in a classifier cache. Quick quizzes record completion time alongside explanations, strengths and weak topics. Interview and communication feedback remains practice guidance, not a hiring decision or psychological assessment. Certificate states require a human reviewer unless an authoritative source is integrated by the institution.

The broader skills API fits its TF-IDF content model to the 100-skill taxonomy in `backend/ml/skill_catalog.py` when the backend starts. It combines that catalog with student profile, quiz, and vacancy-demand signals; it does not train on simulated or actual student outcomes.

Matching, resume parsing, quiz scoring and the original interview assessment run in CAMPUSLINK. The floating placement assistant uses the Groq API when `GROQ_API_KEY` is configured; it receives the current signed-in user's branch focus, year, career goal and listed skills, a locally detected intent, and the latest conversation turns. It does not receive the user's password or bearer token. The resume-specific review separately sends contact-redacted resume content and target-role requirements to Groq after the user submits the analysis form. If Groq is unavailable or unconfigured, the resume report retains its local findings and clearly marks the AI review unavailable. Chart.js and fonts are loaded from public CDNs for presentation. The charts fall back to HTML/CSS bars if the Chart.js script is unavailable.

## API overview

All API payloads and responses use JSON except file upload routes, which accept `multipart/form-data`. Authenticated requests use `Authorization: Bearer <token>`. Errors use `{ "error": "..." }`.

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` |
| Student | `GET/PUT /api/student/profile`, `GET /api/student/dashboard`, `/jobs`, `/applications`, `/notifications` |
| Resume | `POST /api/resume/upload`, `/analyze` (PDF/DOCX/DOC; optional vacancy/job description); `GET /api/resume/analysis` |
| Matching | `POST /api/matching/calculate`; `GET /api/skill-gap/<job_id>`, `/api/recommendations/skills`; student `GET/PUT /api/student/skill-recommendations`, `PUT /api/student/skill-recommendations/progress` |
| Jobs | `GET /api/jobs`, `/api/jobs/<id>`; company `GET/POST /api/company/jobs`, `PUT/DELETE /api/company/jobs/<id>` |
| Applications | `POST /api/jobs/<job_id>/apply`; student and recruiter application lists; `PUT /api/applications/<id>/status` |
| Candidates | `GET /api/company/jobs/<id>/candidates`; `POST /api/company/jobs/<id>/candidates/<student_id>/shortlist` |
| Quizzes | `GET /api/quizzes`, `/api/quizzes/<id>`; `GET /api/quizzes/quick/options`; `POST /api/quizzes/quick/start`, `/api/quizzes/quick/submit`; `POST /api/quizzes/<id>/submit`; `GET /api/quiz-results` |
| Placement assistant | `POST /api/chatbot` (authenticated; Groq API key is backend-only) |
| Interview | `POST /api/interview/start`, `/api/interview/<id>/answer`, `/finish`; `GET /api/interview/<id>/result` |
| Records | Certificates, projects, internships, learning resources, preparation progress and roadmap under `/api/` |
| Calendar / feedback | CRUD `/api/calendar`; `POST /api/feedback` |
| Analytics | `GET /api/admin/dashboard`; `/api/analytics/placements`, `/branches`, `/companies`, `/skills`, `/applications` |
| Admin | `/api/admin/students`, `/companies`, `/jobs`, `/applications`, `/evidence`, `/feedback` |

Use `GET /api/health` for a lightweight service status response. The detailed route descriptions, payload examples and role requirements are in [backend/API.md](backend/API.md); `backend/app.py` contains the complete handlers.

## Project layout

```text
CAMPUSLINK/
  frontend/
    index.html
    assets/css/       Design system and responsive layout
    assets/js/        Vanilla JavaScript SPA and API client
  backend/
    app.py            Flask API routes and local application services
    config.py         Environment-based configuration
    models.py         SQLAlchemy schema
    ml/career_skills.py Rule-based career requirements, resources and proficiency scoring
    ai_service.py     Backend-only Groq client with retries and safe errors
    ml/matching.py    TF-IDF and weighted explainable matching
    ml/prediction.py  Validated readiness model with transparent fallback
    ml/recommendations.py Profile-aware skill ranking
    nlp/intents.py    Local query intent routing
    nlp/resume.py     PDF/DOCX/DOC text extraction and evidence analysis
    database/schema.sql
    seed.py           Idempotent demonstration data
    create_admin.py   Secure placement-officer provisioning prompt
    requirements.txt
    .env.example
    uploads/
```

## Operational notes

- The default secret is for local development only. Set `CAMPUSLINK_SECRET_KEY` before sharing the service.
- The development server is bound to `127.0.0.1` by default. Configure a production WSGI server, TLS, database backups and restricted upload storage before deployment.
- In this package Flask serves both the frontend at `/` and the API below `/api`, so the browser client connects through same-origin relative routes. No separate frontend build server or proxy configuration is needed for local startup.
- `debug` defaults off. Do not enable Flask debug mode on a public interface.
- MySQL credentials and student data are sensitive. Keep `.env` and database backups private.
