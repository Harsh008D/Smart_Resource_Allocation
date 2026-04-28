"""
Geo Router
  POST /ai/geo/cluster  — cluster tasks by location
  POST /ai/geo/route    — compute optimized route for a volunteer
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from geo.engine import TaskCoord, cluster_tasks, nearest_neighbor_route, ClusterResult

router = APIRouter(tags=["Geo"])


# ── Request / Response models ─────────────────────────────────────────────────
class TaskIn(BaseModel):
    task_id:   str
    latitude:  float
    longitude: float


class ClusterRequest(BaseModel):
    tasks: List[TaskIn]


class ClusterResponse(BaseModel):
    clusters:  Dict[str, List[str]]   # cluster_id (str) → task_ids
    centroids: List[Dict[str, Any]]


class RouteRequest(BaseModel):
    volunteer_id: str
    start_lat:    float
    start_lon:    float
    tasks:        List[TaskIn]


class RouteStop(BaseModel):
    task_id:                  str
    latitude:                 float
    longitude:                float
    estimated_travel_minutes: float


class RouteResponse(BaseModel):
    volunteer_id: str
    route:        List[RouteStop]
    is_approximate: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/geo/cluster", response_model=ClusterResponse)
def cluster(req: ClusterRequest):
    if not req.tasks:
        raise HTTPException(status_code=400, detail="tasks list must not be empty")

    task_coords = [TaskCoord(task_id=t.task_id, latitude=t.latitude, longitude=t.longitude)
                   for t in req.tasks]
    result: ClusterResult = cluster_tasks(task_coords)

    return ClusterResponse(
        clusters={str(k): v for k, v in result.clusters.items()},
        centroids=result.centroids,
    )


@router.post("/geo/route", response_model=RouteResponse)
def route(req: RouteRequest):
    if not req.tasks:
        raise HTTPException(status_code=400, detail="tasks list must not be empty")

    task_coords = [TaskCoord(task_id=t.task_id, latitude=t.latitude, longitude=t.longitude)
                   for t in req.tasks]
    stops = nearest_neighbor_route(req.start_lat, req.start_lon, task_coords)

    return RouteResponse(
        volunteer_id=req.volunteer_id,
        route=[
            RouteStop(
                task_id=s.task_id,
                latitude=s.latitude,
                longitude=s.longitude,
                estimated_travel_minutes=s.estimated_travel_minutes,
            )
            for s in stops
        ],
        is_approximate=False,   # straight-line fallback would set True
    )
