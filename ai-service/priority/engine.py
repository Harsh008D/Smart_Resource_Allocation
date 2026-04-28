"""
Priority Engine
───────────────
Formula: priority = (urgency × 0.5) + (people_normalized × 0.3) + (time_delay_normalized × 0.2)
All inputs normalized to [0, 10] before applying weights.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

# ── Compute MAX_PEOPLE from dataset at import time ────────────────────────────
_MAX_PEOPLE: float = 100.0   # fallback default

try:
    _df = pd.read_csv(config.REPORTS_CSV)
    _MAX_PEOPLE = float(_df["people_affected"].quantile(0.95))
except Exception:
    pass  # use default if CSV not available

MAX_HOURS: float = 72.0   # 3 days → normalisation ceiling


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class PriorityResult:
    priority_score:     float
    is_incomplete_score: bool


@dataclass
class RankedReport:
    report_id:     str
    priority_score: float


# ── Normalisation helpers ─────────────────────────────────────────────────────
def normalize_people(n: Optional[float]) -> float:
    """Normalize people_affected to [0, 10]. None → 0."""
    if n is None:
        return 0.0
    return min(float(n) / _MAX_PEOPLE, 1.0) * 10.0


def normalize_time_delay(hours: Optional[float]) -> float:
    """Normalize hours-since-report to [0, 10]. None → 0."""
    if hours is None:
        return 0.0
    return min(float(hours) / MAX_HOURS, 1.0) * 10.0


# ── Core computation ──────────────────────────────────────────────────────────
def compute_priority(
    urgency: Optional[float],
    people: Optional[int],
    submitted_at: Optional[datetime],
) -> PriorityResult:
    """
    Compute priority score.
    Any null input → substitute 0 and flag is_incomplete_score.
    """
    is_incomplete = False

    # urgency is already 0–1; scale to 0–10 for formula consistency
    if urgency is None:
        urgency_val = 0.0
        is_incomplete = True
    else:
        urgency_val = max(0.0, min(float(urgency), 1.0)) * 10.0

    if people is None:
        people_norm = 0.0
        is_incomplete = True
    else:
        people_norm = normalize_people(people)

    if submitted_at is None:
        delay_norm = 0.0
        is_incomplete = True
    else:
        now = datetime.now(timezone.utc)
        if submitted_at.tzinfo is None:
            submitted_at = submitted_at.replace(tzinfo=timezone.utc)
        hours = (now - submitted_at).total_seconds() / 3600.0
        delay_norm = normalize_time_delay(hours)

    score = (urgency_val * 0.5) + (people_norm * 0.3) + (delay_norm * 0.2)
    # Clamp to [0, 10]
    score = max(0.0, min(10.0, score))

    return PriorityResult(priority_score=score, is_incomplete_score=is_incomplete)


# ── Ranked list from DB ───────────────────────────────────────────────────────
def get_ranked_reports(db_conn) -> list[RankedReport]:
    """Query all active reports and return sorted by priority_score descending."""
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT report_id, priority_score
            FROM   reports
            WHERE  processing_status = 'done'
              AND  priority_score IS NOT NULL
            ORDER  BY priority_score DESC
            """
        )
        rows = cur.fetchall()
    return [RankedReport(report_id=r[0], priority_score=r[1]) for r in rows]
