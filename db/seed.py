"""
Seed script: loads the three CSV datasets into PostgreSQL.
Usage: python db/seed.py
Env:   DATABASE_URL (default: postgresql://postgres:postgres@localhost:5432/volunteer_coordination)
"""

import os
import sys
import ast
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/volunteer_coordination",
)

# Datasets live one level above this script (workspace root)
ROOT = Path(__file__).parent.parent
REPORTS_CSV    = ROOT / "reports_dataset_large.csv"
VOLUNTEERS_CSV = ROOT / "volunteers_dataset_large.csv"
TASKS_CSV      = ROOT / "tasks_dataset_large.csv"


def get_conn():
    return psycopg2.connect(DB_URL)


# ── Reports ───────────────────────────────────────────────────────────────────
def seed_reports(conn):
    df = pd.read_csv(REPORTS_CSV)
    required = {"report_id", "text", "latitude", "longitude"}
    skipped = 0
    rows = []

    for _, row in df.iterrows():
        if any(pd.isna(row.get(c)) for c in required):
            skipped += 1
            continue
        rows.append((
            str(row["report_id"]),
            str(row["text"]),
            float(row["latitude"]),
            float(row["longitude"]),
            str(row.get("need_type")) if not pd.isna(row.get("need_type", float("nan"))) else None,
            float(row["urgency_score"]) if not pd.isna(row.get("urgency_score", float("nan"))) else None,
            int(row["people_affected"]) if not pd.isna(row.get("people_affected", float("nan"))) else None,
            str(row["timestamp"]) if not pd.isna(row.get("timestamp", float("nan"))) else None,
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO reports
                (report_id, raw_text, latitude, longitude,
                 need_type, urgency_score, people_affected, submitted_at, processing_status)
            VALUES %s
            ON CONFLICT (report_id) DO NOTHING
            """,
            [(r[0], r[1], r[2], r[3], r[4], r[5], r[6],
              r[7] if r[7] else "NOW()", "done" if r[4] else "pending")
             for r in rows],
        )
    conn.commit()
    print(f"  Reports  : {len(rows)} inserted, {skipped} skipped")


# ── Volunteers ────────────────────────────────────────────────────────────────
def seed_volunteers(conn):
    df = pd.read_csv(VOLUNTEERS_CSV)
    required = {"volunteer_id", "name", "latitude", "longitude"}
    skipped = 0
    rows = []

    for _, row in df.iterrows():
        if any(pd.isna(row.get(c)) for c in required):
            skipped += 1
            continue

        # skills may be a single string — wrap in list
        raw_skills = row.get("skills", "")
        if pd.isna(raw_skills):
            skills = []
        elif isinstance(raw_skills, str) and raw_skills.startswith("["):
            try:
                skills = ast.literal_eval(raw_skills)
            except Exception:
                skills = [raw_skills]
        else:
            skills = [str(raw_skills)]

        availability = bool(str(row.get("availability", "False")).strip().lower() == "true")
        rating = float(row["rating"]) if not pd.isna(row.get("rating", float("nan"))) else 5.0
        email = f"{str(row['volunteer_id']).lower()}@example.com"

        rows.append((
            str(row["volunteer_id"]),
            str(row["name"]),
            email,
            skills,
            float(row["latitude"]),
            float(row["longitude"]),
            availability,
            rating,
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO volunteers
                (volunteer_id, name, email, skills, latitude, longitude, availability, rating)
            VALUES %s
            ON CONFLICT (volunteer_id) DO NOTHING
            """,
            rows,
        )
    conn.commit()
    print(f"  Volunteers: {len(rows)} inserted, {skipped} skipped")


# ── Tasks ─────────────────────────────────────────────────────────────────────
def seed_tasks(conn):
    df = pd.read_csv(TASKS_CSV)
    required = {"task_id", "report_id", "priority_score"}
    skipped = 0
    rows = []

    # Build set of valid report_ids already in DB
    with conn.cursor() as cur:
        cur.execute("SELECT report_id FROM reports")
        valid_reports = {r[0] for r in cur.fetchall()}

    for _, row in df.iterrows():
        if any(pd.isna(row.get(c)) for c in required):
            skipped += 1
            continue
        if str(row["report_id"]) not in valid_reports:
            skipped += 1
            continue

        # assigned_volunteer_ids may be comma-separated or single value
        raw_vids = row.get("assigned_volunteer_ids", "")
        if pd.isna(raw_vids):
            vol_ids = []
        else:
            vol_ids = [v.strip() for v in str(raw_vids).split(",") if v.strip()]

        status = str(row.get("status", "pending")).strip()
        if status not in ("pending", "in_progress", "completed", "cancelled"):
            status = "pending"

        # Use report lat/lon for task location
        with conn.cursor() as cur:
            cur.execute("SELECT latitude, longitude FROM reports WHERE report_id = %s",
                        (str(row["report_id"]),))
            loc = cur.fetchone()
        lat, lon = (loc[0], loc[1]) if loc else (0.0, 0.0)

        rows.append((
            str(row["task_id"]),
            str(row["report_id"]),
            float(row["priority_score"]),
            status,
            vol_ids,
            lat,
            lon,
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO tasks
                (task_id, report_id, priority_score, status,
                 assigned_volunteer_ids, latitude, longitude)
            VALUES %s
            ON CONFLICT (task_id) DO NOTHING
            """,
            rows,
        )
    conn.commit()
    print(f"  Tasks    : {len(rows)} inserted, {skipped} skipped")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"Connecting to {DB_URL} ...")
    try:
        conn = get_conn()
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        sys.exit(1)

    print("Seeding data...")
    seed_reports(conn)
    seed_volunteers(conn)
    seed_tasks(conn)

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
