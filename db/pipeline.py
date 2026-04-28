"""
End-to-end data pipeline.
Loads all three CSVs through the full AI workflow and populates the database.

Usage:
  python db/pipeline.py           # full run
  python db/pipeline.py --dry-run # validate CSVs only, no DB writes

Env: DATABASE_URL, AI_SERVICE_URL, BACKEND_URL
"""
import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent.parent
REPORTS_CSV    = ROOT / "reports_dataset_large.csv"
VOLUNTEERS_CSV = ROOT / "volunteers_dataset_large.csv"
TASKS_CSV      = ROOT / "tasks_dataset_large.csv"

AI_URL      = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
BACKEND_URL = os.getenv("BACKEND_URL",    "http://localhost:4000")


def validate_csvs() -> bool:
    ok = True
    for path, required in [
        (REPORTS_CSV,    {"report_id", "text", "latitude", "longitude"}),
        (VOLUNTEERS_CSV, {"volunteer_id", "name", "latitude", "longitude"}),
        (TASKS_CSV,      {"task_id", "report_id", "priority_score"}),
    ]:
        if not path.exists():
            print(f"  ERROR: {path} not found")
            ok = False
            continue
        df = pd.read_csv(path, nrows=1)
        missing = required - set(df.columns)
        if missing:
            print(f"  ERROR: {path.name} missing columns: {missing}")
            ok = False
        else:
            print(f"  OK: {path.name}")
    return ok


def process_reports(dry_run: bool):
    df = pd.read_csv(REPORTS_CSV)
    total = len(df)
    processed = skipped = 0

    for _, row in df.iterrows():
        if pd.isna(row.get("text")) or pd.isna(row.get("latitude")):
            skipped += 1
            continue

        if dry_run:
            processed += 1
            continue

        try:
            # NLP processing
            nlp = requests.post(f"{AI_URL}/ai/process", json={
                "report_id": str(row["report_id"]),
                "text": str(row["text"]),
            }, timeout=30).json()

            # Priority scoring
            priority = requests.post(f"{AI_URL}/ai/priority", json={
                "report_id": str(row["report_id"]),
                "urgency_score": nlp.get("urgency_score"),
                "people_affected": int(row["people_affected"]) if not pd.isna(row.get("people_affected", float("nan"))) else None,
                "timestamp": str(row["timestamp"]) if not pd.isna(row.get("timestamp", float("nan"))) else None,
            }, timeout=10).json()

            processed += 1
        except Exception as e:
            print(f"  WARN: Failed to process {row['report_id']}: {e}")
            skipped += 1

    print(f"  Reports  : {processed}/{total} processed, {skipped} skipped")


def load_volunteers(dry_run: bool):
    df = pd.read_csv(VOLUNTEERS_CSV)
    total = len(df)
    loaded = skipped = 0

    for _, row in df.iterrows():
        if pd.isna(row.get("name")) or pd.isna(row.get("latitude")):
            skipped += 1
            continue

        if dry_run:
            loaded += 1
            continue

        skills = [str(row["skills"])] if not pd.isna(row.get("skills", float("nan"))) else ["general"]
        try:
            requests.post(f"{BACKEND_URL}/api/volunteers", json={
                "name": str(row["name"]),
                "email": f"{str(row['volunteer_id']).lower()}@example.com",
                "skills": skills,
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "availability": str(row.get("availability", "False")).strip().lower() == "true",
                "rating": float(row["rating"]) if not pd.isna(row.get("rating", float("nan"))) else 5.0,
            }, timeout=10)
            loaded += 1
        except Exception as e:
            print(f"  WARN: Failed to load volunteer {row['volunteer_id']}: {e}")
            skipped += 1

    print(f"  Volunteers: {loaded}/{total} loaded, {skipped} skipped")


def create_tasks(dry_run: bool):
    df = pd.read_csv(TASKS_CSV)
    total = len(df)
    created = skipped = 0

    for _, row in df.iterrows():
        if pd.isna(row.get("report_id")) or pd.isna(row.get("priority_score")):
            skipped += 1
            continue

        if dry_run:
            created += 1
            continue

        try:
            # Get report location
            r = requests.get(f"{BACKEND_URL}/api/reports/{row['report_id']}", timeout=10)
            if r.status_code != 200:
                skipped += 1
                continue
            report = r.json()

            requests.post(f"{BACKEND_URL}/api/tasks", json={
                "report_id": str(row["report_id"]),
                "priority_score": float(row["priority_score"]),
                "latitude": report.get("latitude", 0),
                "longitude": report.get("longitude", 0),
            }, timeout=30)
            created += 1
        except Exception as e:
            print(f"  WARN: Failed to create task {row['task_id']}: {e}")
            skipped += 1

    print(f"  Tasks    : {created}/{total} created, {skipped} skipped")


def main():
    parser = argparse.ArgumentParser(description="Volunteer Coordination Platform — Data Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Validate CSVs without writing to DB")
    args = parser.parse_args()

    print("=== Volunteer Coordination Platform — Data Pipeline ===")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}\n")

    print("Step 1: Validating CSV files...")
    if not validate_csvs():
        print("CSV validation failed. Aborting.")
        sys.exit(1)

    print("\nStep 2: Processing reports through AI pipeline...")
    process_reports(args.dry_run)

    print("\nStep 3: Loading volunteers...")
    load_volunteers(args.dry_run)

    print("\nStep 4: Creating tasks...")
    create_tasks(args.dry_run)

    print("\n=== Pipeline complete ===")


if __name__ == "__main__":
    main()
