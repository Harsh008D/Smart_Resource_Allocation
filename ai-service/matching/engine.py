"""
Volunteer Matching Engine
─────────────────────────
match_score = (skill_match × 0.4) + (distance_score × 0.3) + (rating_normalized × 0.3)

Steps:
  1. Filter: availability == True
  2. Filter: skill overlap with need_type > 0
  3. Score each candidate
  4. Stable-sort descending (tie-break: volunteer_id lexicographic)
  5. Return top 3 (or all if < 3); set is_understaffed flag
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional, List

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class Volunteer:
    volunteer_id: str
    skills:       List[str]
    latitude:     float
    longitude:    float
    availability: bool
    rating:       float   # 0–5


@dataclass
class TaskLocation:
    task_id:   str
    need_type: str
    latitude:  float
    longitude: float
    required_time_window: Optional[str] = None


@dataclass
class MatchCandidate:
    volunteer_id:  str
    match_score:   float
    skill_score:   float
    distance_km:   float
    distance_score: float
    rating:        float


@dataclass
class MatchResult:
    task_id:       str
    matches:       List[MatchCandidate]
    is_understaffed: bool


# ── Haversine distance ────────────────────────────────────────────────────────
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ── Scoring helpers ───────────────────────────────────────────────────────────
def compute_skill_match(volunteer_skills: List[str], need_type: str) -> float:
    """Binary: 1.0 if need_type in volunteer skills, else 0.0."""
    return 1.0 if need_type.lower() in [s.lower() for s in volunteer_skills] else 0.0


def compute_distance_score(dist_km: float) -> float:
    """Linear decay: 1.0 at 0 km, 0.0 at MAX_DISTANCE_KM."""
    return max(0.0, 1.0 - dist_km / config.MAX_DISTANCE_KM)


def compute_match_score(
    skill_match: float,
    distance_score: float,
    rating: float,
) -> float:
    """Weighted composite match score."""
    rating_norm = rating / 5.0
    return (skill_match * 0.4) + (distance_score * 0.3) + (rating_norm * 0.3)


# ── Main matching function ────────────────────────────────────────────────────
def match_volunteers(task: TaskLocation, volunteers: List[Volunteer]) -> MatchResult:
    """
    Filter, score, and rank volunteers for a task.
    Returns top 3 candidates (or all if < 3).
    Deterministic: stable sort with volunteer_id tie-break.
    """
    candidates: List[MatchCandidate] = []

    for vol in volunteers:
        # Filter 1: must be available
        if not vol.availability:
            continue

        # Filter 2: must have skill overlap
        skill = compute_skill_match(vol.skills, task.need_type)
        if skill == 0.0:
            continue

        dist_km = haversine(vol.latitude, vol.longitude, task.latitude, task.longitude)
        dist_score = compute_distance_score(dist_km)
        score = compute_match_score(skill, dist_score, vol.rating)

        candidates.append(MatchCandidate(
            volunteer_id=vol.volunteer_id,
            match_score=score,
            skill_score=skill,
            distance_km=dist_km,
            distance_score=dist_score,
            rating=vol.rating,
        ))

    # Stable sort: descending score, then ascending volunteer_id for determinism
    candidates.sort(key=lambda c: (-c.match_score, c.volunteer_id))

    top3 = candidates[:3]
    return MatchResult(
        task_id=task.task_id,
        matches=top3,
        is_understaffed=len(top3) < 3,
    )
