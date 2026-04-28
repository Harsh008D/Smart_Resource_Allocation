"""
Property-based tests for the Priority Engine.
Feature: volunteer-coordination-platform

Property  8: Priority Score Formula Correctness
Property  9: Priority Score Range Invariant
Property 10: Normalization Range Invariant
Property 11: Priority Ranking Order Invariant
"""
# Feature: volunteer-coordination-platform
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
from hypothesis import given, settings, assume
import hypothesis.strategies as st

from priority.engine import (
    compute_priority,
    normalize_people,
    normalize_time_delay,
    _MAX_PEOPLE,
    MAX_HOURS,
)


# ── Property 8: Formula Correctness ──────────────────────────────────────────
@given(
    urgency=st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
    people=st.integers(min_value=0, max_value=10000),
    hours=st.floats(min_value=0.0, max_value=200.0, allow_nan=False),
)
@settings(max_examples=100)
def test_property_8_formula_correctness(urgency, people, hours):
    """Property 8: computed score matches formula. Validates: Requirements 3.1"""
    submitted_at = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = compute_priority(urgency=urgency, people=people, submitted_at=submitted_at)

    urgency_val  = urgency * 10.0
    people_norm  = normalize_people(people)
    delay_norm   = normalize_time_delay(hours)
    expected     = (urgency_val * 0.5) + (people_norm * 0.3) + (delay_norm * 0.2)
    expected     = max(0.0, min(10.0, expected))

    assert abs(result.priority_score - expected) < 1e-9, (
        f"Score {result.priority_score} != expected {expected}"
    )


# ── Property 9: Score Range Invariant ────────────────────────────────────────
@given(
    urgency=st.one_of(st.none(), st.floats(min_value=0.0, max_value=1.0, allow_nan=False)),
    people=st.one_of(st.none(), st.integers(min_value=0, max_value=100000)),
    hours=st.one_of(st.none(), st.floats(min_value=0.0, max_value=500.0, allow_nan=False)),
)
@settings(max_examples=100)
def test_property_9_score_range(urgency, people, hours):
    """Property 9: priority_score always in [0.0, 10.0]. Validates: Requirements 3.3"""
    submitted_at = (
        datetime.now(timezone.utc) - timedelta(hours=hours)
        if hours is not None else None
    )
    result = compute_priority(urgency=urgency, people=people, submitted_at=submitted_at)
    assert 0.0 <= result.priority_score <= 10.0, (
        f"priority_score {result.priority_score} out of range"
    )


# ── Property 10: Normalization Range Invariant ────────────────────────────────
@given(
    people=st.integers(min_value=0, max_value=1_000_000),
    hours=st.floats(min_value=0.0, max_value=1000.0, allow_nan=False),
)
@settings(max_examples=100)
def test_property_10_normalization_range(people, hours):
    """Property 10: normalized values always in [0.0, 10.0]. Validates: Requirements 3.2"""
    p_norm = normalize_people(people)
    h_norm = normalize_time_delay(hours)
    assert 0.0 <= p_norm <= 10.0, f"people_norm {p_norm} out of range"
    assert 0.0 <= h_norm <= 10.0, f"time_delay_norm {h_norm} out of range"


# ── Property 11: Ranking Order Invariant ─────────────────────────────────────
@given(
    scores=st.lists(
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False),
        min_size=2,
        max_size=20,
    )
)
@settings(max_examples=100)
def test_property_11_ranking_order(scores):
    """Property 11: ranked list is sorted descending. Validates: Requirements 3.4"""
    sorted_scores = sorted(scores, reverse=True)
    for i in range(len(sorted_scores) - 1):
        assert sorted_scores[i] >= sorted_scores[i + 1], (
            f"Ranking not descending at index {i}: {sorted_scores[i]} < {sorted_scores[i+1]}"
        )


# ── Null handling unit tests ──────────────────────────────────────────────────
def test_null_urgency_sets_incomplete():
    result = compute_priority(urgency=None, people=10, submitted_at=datetime.now(timezone.utc))
    assert result.is_incomplete_score is True


def test_null_people_sets_incomplete():
    result = compute_priority(urgency=0.5, people=None, submitted_at=datetime.now(timezone.utc))
    assert result.is_incomplete_score is True


def test_all_nulls_returns_zero():
    result = compute_priority(urgency=None, people=None, submitted_at=None)
    assert result.priority_score == 0.0
    assert result.is_incomplete_score is True
