"""Create and train a clearly synthetic placement-readiness demo model.

The generated records contain no real student data. Their placement outcomes are
simulated, so this model is useful for demonstrating the training workflow only.
Run from the repository root with:

    python backend/ml/train_synthetic_demo.py
"""

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


SEED = 42
RECORD_COUNT = 10_000
ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "demo_artifacts"
DATASET_PATH = ARTIFACTS / "synthetic_student_training.csv"
MODEL_PATH = ARTIFACTS / "synthetic_placement_model.joblib"
METRICS_PATH = ARTIFACTS / "synthetic_training_metrics.json"

NUMERIC_FEATURES = [
    "cgpa", "attendance", "skills", "projects", "internships",
    "certificates", "quiz_score", "interview_score",
]
FEATURES = [*NUMERIC_FEATURES, "branch"]
BRANCHES = ["CSE", "CSE-AI", "IT", "ECE", "EEE", "Mechanical", "Civil", "Data Science"]
BRANCH_EFFECT = {
    "CSE": 0.10,
    "CSE-AI": 0.13,
    "IT": 0.07,
    "ECE": 0.00,
    "EEE": -0.04,
    "Mechanical": -0.06,
    "Civil": -0.08,
    "Data Science": 0.12,
}


def build_pipeline():
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
        ("classifier", LogisticRegression(max_iter=500, class_weight="balanced", random_state=SEED)),
    ])


def generate_records():
    rng = np.random.default_rng(SEED)
    branches = rng.choice(BRANCHES, size=RECORD_COUNT, p=[.25, .12, .16, .14, .08, .10, .07, .08])
    cgpa = np.clip(rng.normal(7.45, 1.05, RECORD_COUNT), 4.0, 10.0)
    attendance = np.clip(rng.normal(81.0, 10.5, RECORD_COUNT), 45.0, 100.0)
    skills = np.clip(rng.poisson(5.5, RECORD_COUNT), 0, 20)
    projects = np.clip(rng.poisson(2.0, RECORD_COUNT), 0, 10)
    internships = np.clip(rng.poisson(0.9, RECORD_COUNT), 0, 6)
    certificates = np.clip(rng.poisson(2.0, RECORD_COUNT), 0, 12)
    quiz_score = np.clip(rng.normal(66.0, 17.0, RECORD_COUNT), 0.0, 100.0)
    interview_score = np.clip(rng.normal(61.0, 19.0, RECORD_COUNT), 0.0, 100.0)

    # A reproducible synthetic relationship creates both placement classes.
    # It is not a claim about real placement behavior or any real institution.
    log_odds = (
        -1.05
        + 0.52 * (cgpa - 7.45)
        + 0.022 * (attendance - 81.0)
        + 0.12 * (skills - 5.5)
        + 0.25 * (projects - 2.0)
        + 0.36 * (internships - 0.9)
        + 0.07 * (certificates - 2.0)
        + 0.012 * (quiz_score - 66.0)
        + 0.014 * (interview_score - 61.0)
        + np.asarray([BRANCH_EFFECT[branch] for branch in branches])
    )
    placement_probability = 1.0 / (1.0 + np.exp(-log_odds))
    placed = rng.binomial(1, placement_probability)

    numeric = np.column_stack([
        cgpa, attendance, skills, projects, internships, certificates,
        quiz_score, interview_score,
    ])
    features = np.column_stack([numeric, branches])
    return features, placed


def write_dataset(features, labels):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with DATASET_PATH.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["synthetic_student_id", *FEATURES, "placed"])
        for index, (row, label) in enumerate(zip(features, labels), start=1):
            values = [round(float(value), 3) for value in row[:-1]]
            writer.writerow([f"SYN-{index:05d}", *values, str(row[-1]), int(label)])


def main():
    features, labels = generate_records()
    write_dataset(features, labels)

    x_train, x_test, y_train, y_test = train_test_split(
        features, labels, test_size=0.25, random_state=SEED, stratify=labels,
    )
    evaluation_model = build_pipeline()
    evaluation_model.fit(x_train, y_train)
    predictions = evaluation_model.predict(x_test)
    probabilities = evaluation_model.predict_proba(x_test)[:, 1]

    model = build_pipeline()
    model.fit(features, labels)
    joblib.dump(model, MODEL_PATH)

    classes, counts = np.unique(labels, return_counts=True)
    class_counts = {"not_placed": 0, "placed": 0}
    for value, count in zip(classes, counts):
        class_counts["placed" if int(value) == 1 else "not_placed"] = int(count)

    metrics = {
        "dataset_type": "synthetic_demo_only",
        "records": int(len(labels)),
        "seed": SEED,
        "features": FEATURES,
        "target": "placed (1=yes, 0=no)",
        "class_counts": class_counts,
        "label_source": "Simulated from a seeded probability formula; not real student outcomes.",
        "model": "scikit-learn LogisticRegression with median imputation, standard scaling, and one-hot branch encoding",
        "parameters": {"max_iter": 500, "class_weight": "balanced", "random_state": SEED},
        "evaluation": {
            "split": "stratified 75/25 holdout",
            "training_records": int(len(y_train)),
            "test_records": int(len(y_test)),
            "balanced_accuracy": round(float(balanced_accuracy_score(y_test, predictions)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
            "confusion_matrix_labels": ["not_placed", "placed"],
            "confusion_matrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
        },
        "final_model_fit_records": int(len(labels)),
        "scikit_learn_version": sklearn.__version__,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "artifacts": {
            "dataset": DATASET_PATH.name,
            "model": MODEL_PATH.name,
            "metrics": METRICS_PATH.name,
        },
        "warning": "Synthetic demo model only. Do not use its scores for real student decisions.",
    }
    METRICS_PATH.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print(f"\nSaved dataset: {DATASET_PATH}")
    print(f"Saved final model: {MODEL_PATH}")


if __name__ == "__main__":
    main()
