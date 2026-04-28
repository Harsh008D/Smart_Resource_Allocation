"""
Property-based tests for the NLP Processing Engine.
Feature: volunteer-coordination-platform

Property 4: NLP Urgency Score Range Invariant
Property 5: NLP Processing Idempotence
Property 6: NLP Fallback Activation
"""
# Feature: volunteer-coordination-platform
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import patch, MagicMock
from hypothesis import given, settings, HealthCheck
import hypothesis.strategies as st

from nlp.engine import process_report, rule_based_extract, NEED_TYPES


# ── Property 4: Urgency Score Range Invariant ─────────────────────────────────
# For any valid report text, urgency_score must be in [0.0, 1.0]
@given(text=st.text(min_size=1, max_size=200))
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_property_4_urgency_score_range(text):
    """Property 4: urgency_score is always in [0.0, 1.0]. Validates: Requirements 2.4"""
    result = process_report(text)
    assert 0.0 <= result.urgency_score <= 1.0, (
        f"urgency_score {result.urgency_score} out of range for text: {text!r}"
    )


# ── Property 5: NLP Processing Idempotence ────────────────────────────────────
# Processing the same text twice must produce equivalent output
@given(text=st.text(min_size=1, max_size=200))
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_property_5_idempotence(text):
    """Property 5: process_report is idempotent. Validates: Requirements 2.7"""
    result1 = process_report(text)
    result2 = process_report(text)
    assert result1.need_type == result2.need_type, (
        f"need_type differs: {result1.need_type} vs {result2.need_type}"
    )
    assert abs(result1.urgency_score - result2.urgency_score) < 1e-6, (
        f"urgency_score differs: {result1.urgency_score} vs {result2.urgency_score}"
    )


# ── Property 6: Fallback Activation ──────────────────────────────────────────
# When model confidence < 0.6, rule-based fallback must be used
@given(text=st.text(min_size=1, max_size=200))
@settings(max_examples=30, suppress_health_check=[HealthCheck.too_slow])
def test_property_6_fallback_activation(text):
    """Property 6: fallback is used when model confidence < 0.6. Validates: Requirements 2.3"""
    # Mock _predict_raw to return low confidence
    low_conf_result = {
        "need_type":     "food",
        "need_conf":     0.3,   # below threshold
        "urgency_score": 0.5,
        "urgency_conf":  0.3,   # below threshold
    }
    with patch("nlp.engine._predict_raw", return_value=low_conf_result):
        result = process_report(text)
    # Both fields should have used fallback
    assert result.used_fallback_need is True, "Expected fallback for need_type"
    assert result.used_fallback_urgency is True, "Expected fallback for urgency_score"


# ── Rule-based tests (unit) ───────────────────────────────────────────────────
def test_rule_based_food_keywords():
    result = rule_based_extract("People are starving and have no food")
    assert result["need_type"] == "food"


def test_rule_based_medical_keywords():
    result = rule_based_extract("Urgent medical help needed, many sick people")
    assert result["need_type"] == "medical"


def test_rule_based_urgency_keywords():
    result = rule_based_extract("This is an emergency, critical situation")
    assert result["urgency_score"] > 0.0


def test_rule_based_no_keywords():
    result = rule_based_extract("xyz abc 123")
    assert result["need_type"] is None
    assert result["urgency_score"] == 0.0
