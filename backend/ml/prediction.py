"""Placement readiness estimates with a stratified, auditable local ML option."""

import logging

try:
    import numpy as np
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import balanced_accuracy_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
except ImportError:
    np = ColumnTransformer = SimpleImputer = LogisticRegression = None
    balanced_accuracy_score = roc_auc_score = train_test_split = Pipeline = OneHotEncoder = StandardScaler = None

from models import (Branch, Certificate, Interview, InterviewResult, Internship, Placement, Project,
                    QuizResult, Student, StudentSkill)


logger = logging.getLogger(__name__)
NUMERIC_FEATURES = ["cgpa", "attendance", "skills", "projects", "internships",
                    "certificates", "quiz_score", "interview_score"]


def _features(student):
    """Use available profile/activity evidence only; never include a placement outcome feature."""
    skills = StudentSkill.query.filter_by(student_id=student.id).count()
    projects = Project.query.filter_by(student_id=student.id).count()
    internships = Internship.query.filter_by(student_id=student.id).count()
    certificates = Certificate.query.filter_by(student_id=student.id).count()
    quizzes = QuizResult.query.filter_by(student_id=student.id).all()
    quiz_avg = sum(x.score for x in quizzes) / len(quizzes) if quizzes else 0
    interview_scores = InterviewResult.query.join(Interview).filter(Interview.student_id == student.id).all()
    interview_avg = sum(x.relevance_score for x in interview_scores) / len(interview_scores) if interview_scores else 0
    branch = db_branch_name(student)
    values = [float(student.cgpa or 0), float(student.attendance or 0), float(skills), float(projects),
              float(internships), float(certificates), float(quiz_avg), float(interview_avg), branch]
    return values


def db_branch_name(student):
    branch = Branch.query.filter_by(id=student.branch_id).first() if student.branch_id else None
    return branch.name if branch else "Unknown"


def _pipeline():
    numeric = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    preprocessor = ColumnTransformer([
        ("numeric", numeric, list(range(len(NUMERIC_FEATURES)))),
        ("branch", OneHotEncoder(handle_unknown="ignore"), [len(NUMERIC_FEATURES)]),
    ])
    return Pipeline([
        ("features", preprocessor),
        ("classifier", LogisticRegression(max_iter=500, class_weight="balanced", random_state=42)),
    ])


def placement_readiness(student):
    current = _features(student)
    cohort = [record for record in Student.query.filter_by(year=student.year).all() if record.id != student.id]
    labels = [1 if Placement.query.filter_by(student_id=record.id).first() else 0 for record in cohort]
    positives = sum(labels)
    negatives = len(labels) - positives
    validation = None

    # Require enough examples of each outcome to hold out a stratified evaluation split.
    enough_data = len(cohort) >= 39 and positives >= 15 and negatives >= 15
    if enough_data and LogisticRegression is not None and np is not None:
        try:
            features = np.asarray([_features(record) for record in cohort], dtype=object)
            target = np.asarray(labels, dtype=int)
            x_train, x_test, y_train, y_test = train_test_split(
                features, target, test_size=0.25, random_state=42, stratify=target,
            )
            evaluation_model = _pipeline()
            evaluation_model.fit(x_train, y_train)
            test_predictions = evaluation_model.predict(x_test)
            test_probabilities = evaluation_model.predict_proba(x_test)[:, 1]
            validation = {
                "split": "stratified 75/25 holdout",
                "training_records": int(len(y_train)),
                "test_records": int(len(y_test)),
                "balanced_accuracy": round(float(balanced_accuracy_score(y_test, test_predictions)), 3),
                "roc_auc": round(float(roc_auc_score(y_test, test_probabilities)), 3),
            }

            # Evaluate on the held-out set, then fit the deployable predictor on all eligible history.
            model = _pipeline()
            model.fit(features, target)
            score = round(float(model.predict_proba(np.asarray([current], dtype=object))[0][1]) * 100)
            return {
                "score": max(0, min(100, score)),
                "method": "Logistic-regression readiness estimate",
                "historical_records": len(cohort),
                "placed_records": positives,
                "validation": validation,
                "note": "Estimate from a locally trained model. Holdout metrics are shown; current profiles are snapshots, so historical pre-placement feature snapshots are unavailable.",
            }
        except (ValueError, ArithmeticError, TypeError) as error:
            logger.warning("Placement readiness model skipped (%s).", type(error).__name__)

    quiz_avg = current[6]
    transparent = min(100, round(current[0] * 5 + current[1] * .15 + min(current[3], 3) * 4
                                 + min(current[5], 3) * 2 + (quiz_avg * .15 if quiz_avg else 0)))
    note = (
        "Transparent rule-based readiness estimate; historical data did not meet the training threshold."
        if not enough_data or LogisticRegression is None or np is None
        else "Transparent rule-based readiness estimate; model validation or fitting was unavailable."
    )
    return {
        "score": transparent,
        "method": "Transparent rule-based readiness estimate",
        "historical_records": len(cohort),
        "placed_records": positives,
        "validation": validation,
        "note": note,
    }
