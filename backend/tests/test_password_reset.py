import hashlib
import os
import unittest
from datetime import date, datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

# Force an isolated in-memory database before importing the configured Flask app.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["CAMPUSLINK_SECRET_KEY"] = "test-only-password-reset-signing-key"

from app import app, db, ensure_schema_compatibility
from models import PasswordRecoveryAttempt, PasswordResetGrant, User
from sqlalchemy import inspect, text


class PasswordResetFlowTests(unittest.TestCase):
    """API integration checks for email, name-prefix, and DOB recovery."""

    test_email = "reset-flow@campuslink.invalid"
    dob = date(2007, 8, 15)

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)

    def setUp(self):
        self.client = app.test_client()
        with app.app_context():
            db.session.remove()
            db.drop_all()
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.session.remove()

    def add_user(self, email=None, name="Reset Test User", role="STUDENT", dob=None):
        with app.app_context():
            user = User(
                name=name,
                email=email or self.test_email,
                password_hash=generate_password_hash("OldPassword123!"),
                role=role,
                date_of_birth=self.dob if dob is None else dob,
            )
            db.session.add(user)
            db.session.commit()
            return user.id

    def verify(self, email=None, prefix="Rese", date_value="2007-08-15"):
        return self.client.post("/api/auth/verify-recovery-details", json={
            "email": email or self.test_email,
            "name_prefix": prefix,
            "date_of_birth": date_value,
        })

    def test_frontend_and_recovery_script_are_served(self):
        page = self.client.get("/")
        script = self.client.get("/assets/js/app.js")

        self.assertEqual(page.status_code, 200)
        self.assertEqual(script.status_code, 200)
        self.assertIn(b'data-form="recovery-email"', script.data)
        self.assertIn(b'name="email"', script.data)
        self.assertIn(b"First 4 letters of registered name", script.data)
        self.assertIn(b"date_of_birth", script.data)
        self.assertNotIn(b"Verify OTP", script.data)
        page.close()
        script.close()

    def test_existing_database_migration_adds_nullable_dob_column(self):
        with app.app_context():
            db.drop_all()
            with db.engine.begin() as connection:
                connection.execute(text(
                    "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(120) NOT NULL, "
                    "email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, "
                    "role VARCHAR(24) NOT NULL, phone VARCHAR(40), active BOOLEAN NOT NULL DEFAULT 1, "
                    "created_at DATETIME NOT NULL)"
                ))
            ensure_schema_compatibility()
            columns = {column["name"]: column for column in inspect(db.engine).get_columns("users")}

        self.assertIn("date_of_birth", columns)
        self.assertTrue(columns["date_of_birth"]["nullable"])

    def test_full_reset_flow_hashes_grant_and_allows_login(self):
        self.add_user()
        verified = self.verify(prefix="rEsE")
        self.assertEqual(verified.status_code, 200)
        reset_token = verified.json["reset_token"]

        with app.app_context():
            challenge = PasswordResetGrant.query.one()
            self.assertNotEqual(challenge.token_hash, reset_token)
            self.assertEqual(challenge.token_hash, hashlib.sha256(reset_token.encode()).hexdigest())
            self.assertEqual(challenge.expires_at - challenge.created_at, timedelta(minutes=10))
            self.assertIsNotNone(challenge.verified_at)

        reset = self.client.post("/api/auth/reset-password", json={
            "reset_token": reset_token,
            "password": "NewPassword456!",
        })
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(reset.json["message"], "Password reset successfully.")
        replay = self.client.post("/api/auth/reset-password", json={
            "reset_token": reset_token,
            "password": "AnotherPassword789!",
        })
        self.assertEqual(replay.status_code, 400)

        with app.app_context():
            user = User.query.filter_by(email=self.test_email).one()
            self.assertTrue(check_password_hash(user.password_hash, "NewPassword456!"))
            self.assertNotEqual(user.password_hash, "NewPassword456!")
            self.assertEqual(PasswordResetGrant.query.count(), 0)

        self.assertEqual(self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "OldPassword123!",
        }).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "NewPassword456!",
        }).status_code, 200)

    def test_recovery_is_role_agnostic(self):
        accounts = [
            ("student@campuslink.invalid", "Stud Ent", "STUDENT", "Stud"),
            ("company@campuslink.invalid", "Comp Any", "COMPANY", "Comp"),
            ("officer@campuslink.invalid", "Offi Cer", "ADMIN", "Offi"),
        ]
        for email, name, role, prefix in accounts:
            self.add_user(email=email, name=name, role=role)
            verified = self.verify(email=email, prefix=prefix)
            self.assertEqual(verified.status_code, 200, role)
            changed = self.client.post("/api/auth/reset-password", json={
                "reset_token": verified.json["reset_token"],
                "password": "NewPassword456!",
            })
            self.assertEqual(changed.status_code, 200, role)

    def test_name_and_dob_failures_share_generic_message(self):
        self.add_user()
        bad_name = self.verify(prefix="Nope")
        bad_dob = self.verify(prefix="Rese", date_value="2007-08-16")
        unknown = self.verify(prefix="Abcd", date_value="2001-01-01")
        unknown_email = self.verify(email="missing@campuslink.invalid")
        missing_email = self.client.post("/api/auth/verify-recovery-details", json={
            "name_prefix": "Rese",
            "date_of_birth": "2007-08-15",
        })

        self.assertEqual(bad_name.status_code, 400)
        self.assertEqual(bad_dob.status_code, 400)
        self.assertEqual(unknown.status_code, 400)
        self.assertEqual(unknown_email.status_code, 400)
        self.assertEqual(missing_email.status_code, 400)
        self.assertEqual(bad_name.json["error"], "The information you entered could not be verified.")
        self.assertEqual(bad_name.json["error"], bad_dob.json["error"])
        self.assertEqual(bad_name.json["error"], unknown.json["error"])
        self.assertEqual(bad_name.json["error"], unknown_email.json["error"])
        self.assertEqual(bad_name.json["error"], missing_email.json["error"])

    def test_email_selects_account_when_other_users_share_name_and_dob(self):
        first_id = self.add_user(email="first@campuslink.invalid", name="Same Name")
        self.add_user(email="second@campuslink.invalid", name="Same User")
        response = self.verify(email="first@campuslink.invalid", prefix="Same")

        self.assertEqual(response.status_code, 200)
        with app.app_context():
            grant = PasswordResetGrant.query.one()
            self.assertEqual(grant.user_id, first_id)

    def test_recovery_attempts_are_limited_and_ip_is_not_stored(self):
        self.add_user()
        for _ in range(5):
            response = self.verify(prefix="Nope")
            self.assertEqual(response.status_code, 400)

        blocked = self.verify(prefix="Rese")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json["error"], "The information you entered could not be verified.")
        with app.app_context():
            attempt = PasswordRecoveryAttempt.query.one()
            self.assertEqual(attempt.attempts, 5)
            self.assertEqual(len(attempt.client_hash), 64)
            self.assertNotIn("127.0.0.1", attempt.client_hash)
            self.assertIsNotNone(attempt.blocked_until)

    def test_expired_reset_grant_is_rejected(self):
        self.add_user()
        verified = self.verify()
        reset_token = verified.json["reset_token"]
        with app.app_context():
            challenge = PasswordResetGrant.query.one()
            challenge.expires_at = datetime.utcnow() - timedelta(seconds=1)
            db.session.commit()

        response = self.client.post("/api/auth/reset-password", json={
            "reset_token": reset_token,
            "password": "NewPassword456!",
        })
        self.assertEqual(response.status_code, 400)

    def test_registration_accepts_optional_dob_without_returning_it(self):
        payload = {
            "name": "New Account",
            "email": "new-account@campuslink.invalid",
            "password": "NewPassword456!",
            "role": "STUDENT",
            "college_name": "CampusLink College",
            "date_of_birth": "2007-08-15",
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("date_of_birth", response.json["user"])
        self.assertTrue(response.json["user"]["date_of_birth_configured"])

        payload["email"] = "missing-dob@campuslink.invalid"
        del payload["date_of_birth"]
        without_dob = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(without_dob.status_code, 201)
        self.assertFalse(without_dob.json["user"]["date_of_birth_configured"])

    def test_signed_in_user_can_set_dob_without_reading_it_back(self):
        user_id = self.add_user()
        with app.app_context():
            user = db.session.get(User, user_id)
            user.date_of_birth = None
            db.session.commit()
        login = self.client.post("/api/auth/login", json={
            "email": self.test_email,
            "password": "OldPassword123!",
        })
        token = login.json["token"]
        response = self.client.put("/api/auth/recovery-details", headers={
            "Authorization": f"Bearer {token}",
        }, json={
            "date_of_birth": "2007-08-15",
            "current_password": "OldPassword123!",
        })
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("date_of_birth", response.json["user"])
        self.assertTrue(response.json["user"]["date_of_birth_configured"])

        with app.app_context():
            user = User.query.filter_by(email=self.test_email).one()
            self.assertEqual(user.date_of_birth, self.dob)


if __name__ == "__main__":
    unittest.main()
