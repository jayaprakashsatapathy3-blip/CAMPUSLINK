# CAMPUSLINK API reference

Base path: `/api`. JSON responses use an `items`, `profile`, `job`, `match`, or `result` envelope depending on the route. Errors return `{ "error": "message" }`. Authenticated routes require `Authorization: Bearer <token>`. The token is signed with `CAMPUSLINK_SECRET_KEY` and expires after seven days.

## Authentication

| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | Public | Student/company registration. `name`, `email`, `password`, and `role` are required; password minimum 8 characters. Optional `date_of_birth` uses `YYYY-MM-DD` for Student/Placement Officer accounts; Company signup ignores DOB. Student registration requires `college_name`; company registration requires `company_name` and may include `industry` and `location`. |
| POST | `/auth/login` | Public | `email`, `password`; returns `{token,user}`. |
| POST | `/auth/verify-recovery-details` | Public | Student and Placement Officer only. Body: `{ "email": "student@example.com", "name_prefix": "Jaya", "date_of_birth": "2007-08-15" }`. Requires the first four letters of the account name (case-insensitive) and stored DOB. Company accounts are rejected here and must use email OTP. Mismatches use a generic error; limited to five recovery requests per client IP per 15 minutes. A match returns a one-use `reset_token` valid for ten minutes. |
| POST | `/auth/company-password-reset/request-otp` | Public | Body: `{ "email": "recruiter@example.com" }`. Sends a 6-digit OTP to an active Company account. Responses do not reveal whether an account exists. OTP expires after five minutes; resend cooldown is 60 seconds. Configure `SMTP_USERNAME`, `SMTP_FROM_EMAIL`, and `SMTP_PASSWORD` in `backend/.env` (Gmail App Password). |
| POST | `/auth/company-password-reset/verify-otp` | Public | Body: `{ "email": "recruiter@example.com", "otp": "123456" }`. Allows at most five code attempts and consumes the OTP on success; returns the same one-use `reset_token` used by `/auth/reset-password`. |
| POST | `/auth/reset-password` | Public | Body: `{ "reset_token": "...", "password": "..." }`. Sets a password of at least eight characters and consumes the one-use reset grant. |
| POST | `/auth/logout` | Any signed-in user | Stateless token; the browser removes it on logout. |
| GET | `/auth/me` | Any signed-in user | Current account and role-specific profile. |
| GET | `/health` | Public | Service and DB driver name. |

Placement officer accounts are provisioned with `python create_admin.py`; they cannot be created through the public registration form.

For Student and Placement Officer accounts, `GET /auth/me` includes only `date_of_birth_configured`, never the DOB itself. Company accounts do not expose or manage DOB. Signed-in non-Company accounts can set/update recovery details with `PUT /auth/recovery-details` and body `{ "date_of_birth": "2007-08-15", "current_password": "..." }`. On startup, `db.create_all()` creates the recovery attempt, reset grant, and Company OTP tables. OTP values are HMAC-hashed, reset grants are SHA-256-hashed, and both are invalidated after successful use. Passwords use the existing Werkzeug password hash.

## Student profile and preparation

- `GET /student/profile` and `PUT /student/profile` — student profile. The update body can include `name`, `phone`, `branch`, `year`, `semester`, `graduation_year` (optional, null clears it, 1900–2100), `cgpa` (0–10), `attendance` (0–100), `career_goal`, `bio`, and `skills` (array or comma-separated string). Existing databases receive a nullable `students.graduation_year` column automatically.
- `GET /student/dashboard` — metrics, skill proficiency and upcoming events.
- `GET /student/jobs` — active vacancies with an estimated match when a student token is supplied.
- `GET /student/applications` — the student’s application records and status timelines.
- `GET /student/notifications` — the student’s alerts.
- `GET /student/roadmap`, `GET /student/preparation`, `PUT /student/progress` — roadmap and progress snapshots. Progress body: `{ "item_type":"roadmap", "item_name":"...", "progress":65 }`.
- `GET /branches`, `GET /skills` — configured reference values.

## Resume, matching and recommendations

- `POST /resume/upload` — multipart form with a `file` field (`.pdf`, `.docx`, or legacy `.doc`; maximum configured upload size).
- `POST /resume/analyze` — analyzes the saved resume or accepts multipart `file`, optional `selected_job_id`, `job_description`, and `job_description_file` fields. Returns evidence sections, exact/partial/missing/additional skills, role match percentage, AI review, and a learning roadmap. Supported job-description files are PDF, DOCX, DOC, and UTF-8 TXT (2 MB max); DOC conversion requires Word, LibreOffice, antiword, or catdoc on the backend host.
- Image-based PDF pages use PyMuPDF OCR when Tesseract OCR is installed on the backend host; configure `TESSDATA_PREFIX` in `backend/.env` to the Tesseract `tessdata` directory and `RESUME_OCR_LANGUAGE` to the matching installed language code. OCR is limited to 20 pages per document.
- `GET /resume/analysis` — latest saved analysis.
- `POST /matching/calculate` — body `{ "job_id": 12 }`; returns score, matched/missing skills, eligibility checks, reasons, and next steps.
- `GET /skill-gap/<job_id>` — skill overlap and missing requirements for a vacancy.
- `GET /recommendations/skills` — in-demand skills not already on the student profile, with local resource suggestions.
- `POST /communication/assess` — `{ "answer":"..." }`; returns local relevance, clarity, grammar indicators, vocabulary and structure signals.

## Vacancies and applications

- `GET /jobs`, `GET /jobs/<id>` — active vacancy listing/details. A valid student bearer token adds a match summary.
- `GET /company/jobs` — recruiter’s vacancies.
- `POST /company/jobs` — recruiter creates a vacancy. Core fields: `title`, `description`, `required_skills` (array or comma-separated), `minimum_cgpa`, `minimum_attendance`, `eligible_branches` (array), `experience`, `certifications`, `salary`, `location`, `vacancies`, `deadline`, `terms`.
- `PUT /company/jobs/<id>` — recruiter updates their vacancy. `DELETE /company/jobs/<id>` closes it (soft close).
- `POST /jobs/<job_id>/apply` — student applies once; response includes the saved application and match explanation.
- `GET /company/jobs/<job_id>/applications` — applications for an owned vacancy, ranked by match.
- `GET /company/jobs/<job_id>/candidates` — only students who meet the vacancy’s branch, CGPA and attendance criteria, ranked by match.
- `POST /company/jobs/<job_id>/candidates/<student_id>/shortlist` — creates or updates a shortlisted application if the student is eligible.
- `PUT /applications/<id>/status` — recruiter for the owning job or placement officer; body `{ "status":"Interview" }`. Allowed states: `Applied`, `Shortlisted`, `Assessment`, `Interview`, `Selected`, `Offer`, `Joined`, `Rejected`.

Creating a new vacancy checks eligible students and adds one deduplicated in-app alert to each eligible student with a score of at least 85. Match scores are **Estimated Job Match**, not the probability of hiring.

## Evidence, quizzes and interviews

- `POST /certificates/upload` — JSON or multipart fields `name`/`course_name`, `type`, `certificate_id`, `issuer`, `completion_date`, `score` (NPTEL), `url`, optional `file`. New records use `REQUIRES_REVIEW`.
- `GET /certificates` — student’s own certificates or officer review list.
- `PUT /certificates/<id>/verify` — officer body `{ "status":"VERIFIED" }`; statuses: `VERIFIED`, `UNVERIFIED`, `REQUIRES_REVIEW`, `SUSPICIOUS`.
- `POST /student/projects`, `GET /student/projects` — project body includes `title`, `description`, `technologies`, `github_url`, `demo_url`.
- `POST /student/internships`, `GET /student/internships` — internship body includes `company`, `role`, `duration`, `description`, `certificate_url`.
- `GET /admin/evidence`, `PUT /verification/project/<id>`, `PUT /verification/internship/<id>` — officer evidence review; body `{ "status":"Verified" }` or `Pending` / `Rejected`.
- `GET /quizzes`, `GET /quizzes/<id>`, `POST /quizzes/<id>/submit` — quiz answers are an object keyed by question ID, e.g. `{ "answers":{"4":1,"5":0} }`. Correct answers are not returned before submit.
- `GET /quizzes/quick/options` — signed-in student's supported AI categories, recommended difficulty, today's server-side allowance, and any resumable attempt.
- `POST /quizzes/quick/start` — student body `{ "category":"Python", "topic":"decorators", "difficulty":"Medium", "count":10 }`; generates a fresh quiz and returns a signed token and questions without answer keys. A unique user/local-date record allows one successful generation per day; provider or validation failures release their reservation.
- `POST /quizzes/quick/progress` — `{ "attempt_token":"...", "revision":1, "answers":{"4":1} }`; saves selected answers for refresh recovery without returning correct answers.
- `POST /quizzes/quick/submit` — `{ "attempt_token":"...", "answers":{"4":1,"5":0} }`; validates the authenticated owner and saved attempt, atomically records one result, and then returns answer explanations, topic scores, strengths and focused recommendations.
- Quick Quiz categories include Programming, Python, Java, SQL, Web Development, Aptitude, Logical Reasoning, Mathematics, Science, General Knowledge, English, Interview Preparation, Mixed and Custom Topic. The daily date is determined by `APP_TIMEZONE` (default `Asia/Kolkata`).
- `GET /quiz-results` — student’s attempts and quick-quiz improvement notes.
- `POST /interview/start` — `{ "category":"Python" }`; returns local question IDs and prompts.
- `POST /interview/<id>/answer` — `{ "question_id":4, "answer":"..." }`; gives automated practice scores and feedback.
- `POST /interview/<id>/finish`, `GET /interview/<id>/result` — overall practice result.
- `GET /resources` — local learning-resource catalogue; optional `skill` query filter.

## Placement assistant

- `POST /chatbot` — authenticated request body `{ "mode":"mock_interview", "messages":[{"role":"user","content":"Start a mock interview."}] }`. Supported modes include placement, technical/HR/coding interviews, aptitude practice, resume help, placement roadmap, company preparation, turn-based mock interview and the Communication Practice English coach. Placement-assistant responses include a local intent label; short contextual follow-ups inherit the previous user topic when appropriate. The coach uses `mode: "communication_coach"` or `"communication_report"`, plus `practice_mode` (`daily`, `interview`, `professional`, `vocabulary` or `grammar`), `difficulty`, `session_memory` and the current conversation. Coach replies include adaptive difficulty, optional evaluation, corrected phrasing, mistake explanations, and vocabulary suggestions; report requests return the communication rubric and recommendations. Conversation and session notes are held for the active browser session and sent through the same Groq integration. The backend adds limited student context (name, branch focus, year and career goal for coach sessions; profile branch, year, career goal and listed skills for the placement assistant); `GROQ_API_KEY` remains in `backend/.env`. The key and user prompt contents are not logged. A missing Groq key, quota response or network failure returns a clear `503` error instead of a generated substitute response.

## Calendar, notifications and feedback

- `GET /calendar`, `POST /calendar`, `PUT /calendar/<id>`, `DELETE /calendar/<id>` — caller-owned events. Create/update uses `{ "title":"Interview", "type":"Interview", "starts_at":"2026-10-20T11:00:00", "notes":"..." }`.
- `GET /notifications`, `PUT /notifications/<id>/read` — caller-owned notifications.
- `POST /feedback` — `{ "rating":5, "category":"AI Matching", "message":"..." }`.

## Company and placement analytics

- `GET /company/profile`, `PUT /company/profile`, `GET /company/dashboard` — recruiter profile and activity.
- `GET /analytics/placements`, `/analytics/branches`, `/analytics/companies`, `/analytics/skills`, `/analytics/applications` — authorized analytics (placement officer; some aggregate hiring views are also available to recruiters).
- Skill demand accepts optional `company`, `branch`, `role`, `date_from`, and `date_to` query filters.
- `GET /admin/dashboard`, `/admin/students`, `/admin/companies`, `/admin/jobs`, `/admin/applications`, `/admin/placements`, `/admin/feedback` — officer views.
- `POST /placement/records` — officer adds a confirmed placement using `student_id`, optional `job_id`, `package_lpa`, and optional `placement_date`.

## Sample request

```http
POST /api/matching/calculate
Authorization: Bearer <token>
Content-Type: application/json

{"job_id":3}
```
