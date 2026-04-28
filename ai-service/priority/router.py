"""
Priority Router
  POST /ai/priority          — compute priority score for a single report
  GET  /ai/priority/ranked   — return all reports ranked by priority_score
"""
from datetime import datetime
from typing import Optional, List

import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from priority.engine import compute_priority, get_ranked_reports, PriorityResult, RankedReport

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

router = APIRouter(tags=["Priority"])


# ── Request / Response models ─────────────────────────────────────────────────
class PriorityRequest(BaseModel):
    report_id:    Optional[str]      = None
    urgency_score: Optional[float]   = None
    people_affected: Optional[int]   = None
    timestamp:    Optional[datetime] = None


class PriorityResponse(BaseModel):
    report_id:           Optional[str]
    priority_score:      float
    is_incomplete_score: bool


class RankedReportOut(BaseModel):
    report_id:     str
    priority_score: float


class RankedResponse(BaseModel):
    reports: List[RankedReportOut]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/priority", response_model=PriorityResponse)
def priority(req: PriorityRequest):
    result: PriorityResult = compute_priority(
        urgency=req.urgency_score,
        people=req.people_affected,
        submitted_at=req.timestamp,
    )
    return PriorityResponse(
        report_id=req.report_id,
        priority_score=result.priority_score,
        is_incomplete_score=result.is_incomplete_score,
    )


@router.get("/priority/ranked", response_model=RankedResponse)
def ranked():
    try:
        conn = psycopg2.connect(config.DATABASE_URL)
        reports = get_ranked_reports(conn)
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

    return RankedResponse(
        reports=[RankedReportOut(report_id=r.report_id, priority_score=r.priority_score)
                 for r in reports]
    )
