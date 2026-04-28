"""
Geo-Optimizer
─────────────
- cluster_tasks:          K-Means clustering of task coordinates
- nearest_neighbor_route: Greedy nearest-neighbor route ordering
- should_recluster:       Trigger when task count changes > 10%
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Dict

import numpy as np
from sklearn.cluster import KMeans

from matching.engine import haversine   # reuse Haversine from matching module

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class TaskCoord:
    task_id:   str
    latitude:  float
    longitude: float


@dataclass
class ClusterResult:
    clusters: Dict[int, List[str]]   # cluster_id → list of task_ids
    centroids: List[dict]            # [{cluster_id, latitude, longitude}]


@dataclass
class RouteStop:
    task_id:                  str
    latitude:                 float
    longitude:                float
    estimated_travel_minutes: float


# ── Clustering ────────────────────────────────────────────────────────────────
def cluster_tasks(tasks: List[TaskCoord]) -> ClusterResult:
    """
    Group tasks into geographic clusters using K-Means.
    k = max(1, len(tasks) // 5)
    random_state=42 for determinism.
    """
    if not tasks:
        return ClusterResult(clusters={}, centroids=[])

    k = max(1, len(tasks) // 5)
    coords = np.array([[t.latitude, t.longitude] for t in tasks])

    kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
    labels = kmeans.fit_predict(coords)

    clusters: Dict[int, List[str]] = {}
    for task, label in zip(tasks, labels):
        clusters.setdefault(int(label), []).append(task.task_id)

    centroids = [
        {
            "cluster_id": i,
            "latitude":   float(kmeans.cluster_centers_[i][0]),
            "longitude":  float(kmeans.cluster_centers_[i][1]),
        }
        for i in range(k)
    ]

    return ClusterResult(clusters=clusters, centroids=centroids)


# ── Route optimization ────────────────────────────────────────────────────────
def nearest_neighbor_route(
    start_lat: float,
    start_lon: float,
    tasks: List[TaskCoord],
) -> List[RouteStop]:
    """
    Greedy nearest-neighbor route starting from (start_lat, start_lon).
    Travel time estimate: distance_km / AVG_SPEED_KMH * 60 minutes.
    """
    if not tasks:
        return []

    unvisited = list(tasks)
    route: List[RouteStop] = []
    current_lat, current_lon = start_lat, start_lon

    while unvisited:
        nearest = min(
            unvisited,
            key=lambda t: haversine(current_lat, current_lon, t.latitude, t.longitude),
        )
        dist_km = haversine(current_lat, current_lon, nearest.latitude, nearest.longitude)
        travel_min = (dist_km / config.AVG_SPEED_KMH) * 60.0

        route.append(RouteStop(
            task_id=nearest.task_id,
            latitude=nearest.latitude,
            longitude=nearest.longitude,
            estimated_travel_minutes=max(0.0, travel_min),
        ))

        current_lat, current_lon = nearest.latitude, nearest.longitude
        unvisited.remove(nearest)

    return route


# ── Recluster trigger ─────────────────────────────────────────────────────────
def should_recluster(new_count: int, last_count: int) -> bool:
    """Return True when task count changed by more than 10%."""
    if last_count == 0:
        return new_count > 0
    return abs(new_count - last_count) / last_count > 0.10
