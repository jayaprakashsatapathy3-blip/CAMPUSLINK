import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
_UPLOAD = Path(os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads")))
if not _UPLOAD.is_absolute():
    _UPLOAD = BASE_DIR / _UPLOAD


class Config:
    SECRET_KEY = os.getenv("CAMPUSLINK_SECRET_KEY", "change-this-secret-before-deployment")
    # SQLite keeps the demo easy to start; set DATABASE_URL to a MySQL URL for the
    # production-style setup documented in README.md.
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'campuslink.db').as_posix()}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
    UPLOAD_FOLDER = str(_UPLOAD)
    TOKEN_MAX_AGE = 60 * 60 * 24 * 7
    APP_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
