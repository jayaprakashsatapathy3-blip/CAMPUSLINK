"""Provision a placement officer account without enabling public admin signup."""
from getpass import getpass
import re

from werkzeug.security import generate_password_hash

from app import app
from models import PlacementOfficer, User, db


def main():
    with app.app_context():
        db.create_all()
        name=input("Placement officer name: ").strip()
        email=input("Placement officer email: ").strip().lower()
        password=getpass("Password (8+ characters): ")
        if not name or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email) or len(password)<8:
            raise SystemExit("Enter a name, valid email and password of at least 8 characters.")
        if User.query.filter_by(email=email).first():
            raise SystemExit("That email is already registered.")
        user=User(name=name,email=email,password_hash=generate_password_hash(password),role="ADMIN")
        db.session.add(user);db.session.flush();db.session.add(PlacementOfficer(user_id=user.id));db.session.commit()
        print(f"Placement officer account created for {email}.")


if __name__=="__main__":
    main()
