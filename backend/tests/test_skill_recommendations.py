"""Integration tests for the authenticated career skill recommendation flow."""

import os
import unittest
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CAMPUSLINK_SECRET_KEY"] = "test-only-campuslink-skill-recommendations-key"

from app import app, db, serializer
from models import Branch, Skill, SkillLearningPlan, Student, StudentSkill, User
from werkzeug.security import generate_password_hash


class SkillRecommendationAPITests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()
        with app.app_context():
            db.session.remove()
            db.drop_all()
            db.create_all()
            branch = Branch(name="CSE")
            user = User(name="Recommendation Student", email="recommendation@example.invalid",
                        password_hash=generate_password_hash("Password123!"), role="STUDENT")
            db.session.add_all([branch, user])
            db.session.flush()
            student = Student(user_id=user.id, branch_id=branch.id, career_goal="Software Engineer")
            db.session.add(student)
            db.session.commit()
            self.user_id = user.id
            self.student_id = student.id
            self.auth = {"Authorization": "Bearer " + serializer.dumps({"uid": user.id})}

    def tearDown(self):
        with app.app_context():
            db.session.remove()

    def test_recommendation_page_requires_student_authentication(self):
        response = self.client.get("/api/student/skill-recommendations")
        self.assertEqual(response.status_code, 401)

        response = self.client.get("/api/student/skill-recommendations", headers=self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json["career_id"])
        self.assertEqual(len(response.json["careers"]), 5)
        self.assertEqual(response.json["current_skills"], [])

    def test_career_and_proficiency_changes_update_recommendations_and_persist(self):
        response = self.client.put("/api/student/skill-recommendations", headers=self.auth, json={
            "career_id": "frontend_developer",
            "skills": [
                {"name": "HTML", "proficiency": 90},
                {"name": "CSS", "proficiency": 80},
                {"name": "JavaScript", "proficiency": 25},
            ],
        })
        self.assertEqual(response.status_code, 200)
        payload = response.json
        self.assertEqual(payload["career_goal"], "Frontend Developer")
        self.assertEqual(payload["career_id"], "frontend_developer")
        self.assertGreater(payload["readiness"], 0)

        recommendations = {item["name"]: item for item in payload["recommendations"]}
        self.assertEqual(recommendations["JavaScript"]["priority"], "HIGH")
        self.assertEqual(recommendations["DOM Manipulation"]["priority"], "HIGH")
        self.assertEqual(recommendations["Git"]["priority"], "MEDIUM")
        self.assertEqual(recommendations["Responsive Design"]["priority"], "LOW")
        self.assertIn("DOM Manipulation", [item["name"] for item in payload["missing_skills"]])
        self.assertNotIn("JavaScript", [item["name"] for item in payload["missing_skills"]])

        refreshed = self.client.get("/api/student/skill-recommendations", headers=self.auth)
        self.assertEqual(refreshed.status_code, 200)
        self.assertEqual(refreshed.json["career_id"], "frontend_developer")
        saved_skills = {item["name"]: item["proficiency"] for item in refreshed.json["current_skills"]}
        self.assertEqual(saved_skills["JavaScript"], 25)
        with app.app_context():
            self.assertEqual(SkillLearningPlan.query.filter_by(student_id=self.student_id, career_id="frontend_developer").count(), 8)
            js_skill = Skill.query.filter_by(name="JavaScript").one()
            self.assertEqual(StudentSkill.query.filter_by(student_id=self.student_id, skill_id=js_skill.id).one().proficiency, 25)

        backend = self.client.put("/api/student/skill-recommendations", headers=self.auth,
                                  json={"career_id": "backend_developer"})
        self.assertEqual(backend.status_code, 200)
        self.assertEqual(backend.json["career_goal"], "Backend Developer")
        self.assertIn("REST APIs", [item["name"] for item in backend.json["missing_skills"]])

    def test_progress_status_persists_and_completion_updates_skill_proficiency(self):
        self.client.put("/api/student/skill-recommendations", headers=self.auth,
                        json={"career_id": "frontend_developer"})

        response = self.client.put("/api/student/skill-recommendations/progress", headers=self.auth, json={
            "career_id": "frontend_developer", "skill": "React", "status": "In Progress",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(next(item for item in response.json["recommendations"] if item["name"] == "React")["status"], "In Progress")

        response = self.client.put("/api/student/skill-recommendations/progress", headers=self.auth, json={
            "career_id": "frontend_developer", "skill": "JavaScript", "status": "Completed",
        })
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("JavaScript", [item["name"] for item in response.json["recommendations"]])
        self.assertIn("JavaScript", [item["name"] for item in response.json["completed_skills"]])

        with app.app_context():
            js_skill = Skill.query.filter_by(name="JavaScript").one()
            self.assertGreaterEqual(StudentSkill.query.filter_by(student_id=self.student_id, skill_id=js_skill.id).one().proficiency, 70)
            saved_plan = SkillLearningPlan.query.filter_by(student_id=self.student_id, career_id="frontend_developer", skill_key="javascript").one()
            self.assertEqual(saved_plan.status, "Completed")

        refreshed = self.client.get("/api/student/skill-recommendations", headers=self.auth)
        self.assertIn("JavaScript", [item["name"] for item in refreshed.json["completed_skills"]])
        self.assertEqual(next(item for item in refreshed.json["recommendations"] if item["name"] == "React")["status"], "In Progress")

    def test_invalid_career_skill_and_progress_values_are_rejected(self):
        invalid_career = self.client.put("/api/student/skill-recommendations", headers=self.auth,
                                         json={"career_id": "made_up_role"})
        self.assertEqual(invalid_career.status_code, 400)

        invalid_proficiency = self.client.put("/api/student/skill-recommendations", headers=self.auth, json={
            "career_id": "frontend_developer", "skills": [{"name": "JavaScript", "proficiency": 101}],
        })
        self.assertEqual(invalid_proficiency.status_code, 400)

        fractional_proficiency = self.client.put("/api/student/skill-recommendations", headers=self.auth, json={
            "career_id": "frontend_developer", "skills": [{"name": "JavaScript", "proficiency": 65.5}],
        })
        self.assertEqual(fractional_proficiency.status_code, 400)

        invalid_skill = self.client.put("/api/student/skill-recommendations/progress", headers=self.auth, json={
            "career_id": "frontend_developer", "skill": "Kubernetes", "status": "Completed",
        })
        self.assertEqual(invalid_skill.status_code, 400)

        invalid_status = self.client.put("/api/student/skill-recommendations/progress", headers=self.auth, json={
            "career_id": "frontend_developer", "skill": "React", "status": "Paused",
        })
        self.assertEqual(invalid_status.status_code, 400)

    def test_dashboard_assets_include_theme_responsive_layout_and_navigation(self):
        project_root = Path(__file__).resolve().parents[2]
        html = (project_root / "frontend" / "index.html").read_text(encoding="utf-8")
        css = (project_root / "frontend" / "assets" / "css" / "skill-recommendations.css").read_text(encoding="utf-8")
        javascript = (project_root / "frontend" / "assets" / "js" / "app.js").read_text(encoding="utf-8")

        self.assertIn('/assets/css/skill-recommendations.css', html)
        self.assertIn('data-theme="light"', css)
        self.assertIn('@media (max-width: 800px)', css)
        self.assertIn('@media (max-width: 560px)', css)
        self.assertIn('data-action="select-skill-career"', javascript)
        self.assertIn('id="skill-rec-search"', javascript)
        self.assertIn('filter-skill-recommendations', javascript)
        self.assertIn('renderPage', javascript)  # The shared page wrapper supplies the app back button.


if __name__ == "__main__":
    unittest.main()
