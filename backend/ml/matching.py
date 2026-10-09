import re

from ml.skills import match_skill_lists

MIN_PLACEMENT_SEMESTER = 5
MAX_PLACEMENT_SEMESTER = 8

def _normal(value):
    return re.sub(r"[^a-z0-9+#.]", " ", (value or "").lower()).strip()


def _branch_key(value):
    return re.sub(r"[\W_]+", "", (value or "").casefold(), flags=re.UNICODE)


def match_student_to_job(student, job, skill_names, projects, internships, certificates, quiz_average=0):
    skill_catalog = [*skill_names, *student.get("skills", [])]
    skill_match = match_skill_lists(student.get("skills", []), skill_names, skill_catalog)
    matched = skill_match["matched_skills"]
    missing = skill_match["missing_skills"]
    # Keep the skill component an exact required-skill percentage. Overall job fit
    # remains a separate weighted score that includes academics and evidence.
    skill_score = skill_match["match_percentage"]
    cgpa_req = float(job.get("minimum_cgpa") or 0)
    attendance_req = float(job.get("minimum_attendance") or 0)
    cgpa_score = min(100, (float(student.get("cgpa") or 0) / max(cgpa_req, 10)) * 100) if cgpa_req else min(100, float(student.get("cgpa") or 0) * 10)
    attendance_score = min(100, (float(student.get("attendance") or 0) / max(attendance_req, 100)) * 100) if attendance_req else float(student.get("attendance") or 0)
    project_score = min(100, len(projects) * 25)
    internship_score = min(100, len(internships) * 40)
    required_certs={_normal(x) for x in job.get("certifications",[]) if _normal(x)}
    available_certs={_normal(x) for x in certificates if _normal(x)}
    matched_certs=sorted(x for x in required_certs if any(x in available for available in available_certs))
    missing_certs=sorted(required_certs-set(matched_certs))
    cert_score=(len(matched_certs)/max(1,len(required_certs))*100) if required_certs else min(100,len(available_certs)*40)
    score = round(skill_score * .50 + cgpa_score * .15 + project_score * .10 + internship_score * .10 + cert_score * .05 + attendance_score * .05 + float(quiz_average or 0) * .05)

    branches = job.get("eligible_branches", [])
    eligible_branch_keys = {_branch_key(branch) for branch in branches if _branch_key(branch)}
    student_branch_key = _branch_key(student.get("branch", ""))
    branch_ok = not eligible_branch_keys or student_branch_key in eligible_branch_keys
    try:
        semester = int(student.get("semester") or 0)
    except (TypeError, ValueError):
        semester = 0
    semester_ok = MIN_PLACEMENT_SEMESTER <= semester <= MAX_PLACEMENT_SEMESTER
    cgpa_ok = float(student.get("cgpa") or 0) >= cgpa_req
    attendance_ok = float(student.get("attendance") or 0) >= attendance_req
    certifications_ok = not missing_certs
    eligible = semester_ok and branch_ok and cgpa_ok and attendance_ok and certifications_ok
    required_count = skill_match["total_required_skills"]
    reasons = [f"{len(matched)}/{required_count} required skills matched" if required_count else "No mandatory skills listed"]
    reasons += [f"Semester requirement satisfied (5–8)" if semester_ok else "Placement applications are available to students in semesters 5–8", f"CGPA requirement {'satisfied' if cgpa_ok else 'not met'}", f"Attendance requirement {'satisfied' if attendance_ok else 'not met'}", "Eligible branch" if branch_ok else "Branch is not in the eligible list"]
    if required_certs:reasons.append(f"Required certifications {'satisfied' if certifications_ok else 'missing'}")
    if projects:
        reasons.append("Relevant project evidence found")
    recs = [f"Complete or submit {s}" for s in missing_certs[:2]]
    return {"score": max(0, min(100, score)), "label": "Estimated Job Match", "matched_skills": matched, "missing_skills": missing, "total_required_skills": skill_match["total_required_skills"], "skill_match_percentage": skill_match["match_percentage"], "matched_certifications": matched_certs, "missing_certifications": missing_certs, "eligible": eligible, "semester_eligible": semester_ok, "reasons": reasons, "recommendations": recs, "components": {"skills": skill_match["match_percentage"], "cgpa": round(cgpa_score), "projects": round(project_score), "internships": round(internship_score), "certifications": round(cert_score), "attendance": round(attendance_score), "quiz": round(float(quiz_average or 0))}}
