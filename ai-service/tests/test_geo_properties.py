"""
Property-based tests for the Geo-Optimizer.
Feature: volunteer-coordination-platform

Property 20: Geo-Clustering Partition Invariant
Property 21: Route Completeness
Property 22: Route Travel Times Non-Negative
"""
# Feature: volunteer-coordination-platform
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from hypothesis import given, settings
import hypothesis.strategies as st

from geo.engine import TaskCoord, cluster_tasks, nearest_neighbor_route, should_recluster


# ── Strategy ──────────────────────────────────────────────────────────────────
def task_coord_strategy():
    return st.builds(
        TaskCoord,
        task_id=st.text(min_size=1, max_size=10, alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
        latitude=st.floats(min_value=-90, max_value=90, allow_nan=False),
        longitude=st.floats(min_value=-180, max_value=180, allow_nan=False),
    )


# ── Property 20: Clustering Partition Invariant ───────────────────────────────
@given(tasks=st.lists(task_coord_strategy(), min_size=1, max_size=50))
@settings(max_examples=50)
def test_property_20_clustering_partition(tasks):
    """Property 20: every task appears in exactly one cluster. Validates: Requirements 6.1"""
    result = cluster_tasks(tasks)

    all_assigned = []
    for task_ids in result.clusters.values():
        all_assigned.extend(task_ids)

    input_ids = [t.task_id for t in tasks]

    # Every input task must appear exactly once
    assert sorted(all_assigned) == sorted(input_ids), (
        f"Cluster partition mismatch: {sorted(all_assigned)} vs {sorted(input_ids)}"
    )


# ── Property 21: Route Completeness ──────────────────────────────────────────
@given(tasks=st.lists(task_coord_strategy(), min_size=1, max_size=20))
@settings(max_examples=50)
def test_property_21_route_completeness(tasks):
    """Property 21: route contains every task exactly once. Validates: Requirements 6.2"""
    route = nearest_neighbor_route(23.0, 72.5, tasks)

    route_ids = [stop.task_id for stop in route]
    input_ids = [t.task_id for t in tasks]

    assert sorted(route_ids) == sorted(input_ids), (
        f"Route missing tasks: {sorted(route_ids)} vs {sorted(input_ids)}"
    )
    # No duplicates
    assert len(route_ids) == len(set(route_ids)), "Route contains duplicate task_ids"


# ── Property 22: Travel Times Non-Negative ────────────────────────────────────
@given(tasks=st.lists(task_coord_strategy(), min_size=2, max_size=20))
@settings(max_examples=50)
def test_property_22_travel_times_non_negative(tasks):
    """Property 22: all travel times >= 0. Validates: Requirements 6.3"""
    route = nearest_neighbor_route(23.0, 72.5, tasks)
    for stop in route:
        assert stop.estimated_travel_minutes >= 0.0, (
            f"Negative travel time: {stop.estimated_travel_minutes}"
        )


# ── Recluster trigger unit tests ──────────────────────────────────────────────
def test_should_recluster_above_threshold():
    assert should_recluster(12, 10) is True   # 20% change


def test_should_not_recluster_below_threshold():
    assert should_recluster(10, 10) is False  # 0% change


def test_should_recluster_zero_last():
    assert should_recluster(5, 0) is True


# ── Empty input edge cases ────────────────────────────────────────────────────
def test_cluster_empty():
    result = cluster_tasks([])
    assert result.clusters == {}


def test_route_empty():
    result = nearest_neighbor_route(23.0, 72.5, [])
    assert result == []
