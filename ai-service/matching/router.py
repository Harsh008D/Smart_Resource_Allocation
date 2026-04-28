"""
Matching Router — POST /ai/match
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from matching.engine import (
    Volunteer, TaskLocation, MatchCandidate, MatchResult, match_volunteers
)

router = APIRouter(tags=["Matching"])


class VolunteerIn(BaseModel):
    volunteer_id: str
    skills:       List[str]
    latitude:     float
    longitude:    float
    availability: bool
    rating:       float


class MatchRequest(BaseModel):
    task_id:              str
    need_type:            str
    latitude:             float
    longitude:            float
    required_time_window: Optional[str] = None
    volunteers:           List[VolunteerIn]


class MatchCandidateOut(BaseModel):
    volunteer_id:   str
    match_score:    float
    skill_score:    float
    distance_km:    float
    distance_score: float
    rating:         float


class MatchResponse(BaseModel):
    task_id:        str
    matches:        List[MatchCandidateOut]
    is_understaffed: bool


@router.post("/match", response_model=MatchResponse)
def match(req: MatchRequest):
    if not req.volunteers:
        raise HTTPException(status_code=400, detail="volunteers list must not be empty")

    task = TaskLocation(
        task_id=req.task_id,
        need_type=req.need_type,
        latitude=req.latitude,
        longitude=req.longitude,
        required_time_window=req.required_time_window,
    )
    vols = [
        Volunteer(
            volunteer_id=v.volunteer_id,
            skills=v.skills,
            latitude=v.latitude,
            longitude=v.longitude,
            availability=v.availability,
            rating=v.rating,
        )
        for v in req.volunteers
    ]

    result: MatchResult = match_volunteers(task, vols)

    return MatchResponse(
        task_id=result.task_id,
        matches=[
            MatchCandidateOut(
                volunteer_id=c.volunteer_id,
                match_score=c.match_score,
                skill_score=c.skill_score,
                distance_km=c.distance_km,
                distance_score=c.distance_score,
                rating=c.rating,
            )
            for c in result.matches
        ],
        is_understaffed=result.is_understaffed,
    )
