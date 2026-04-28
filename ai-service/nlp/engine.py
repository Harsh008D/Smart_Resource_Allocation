"""
NLP Processing Engine
─────────────────────
Primary:  DistilBERT fine-tuned with a classification head (need_type)
          and a regression head (urgency_score).
Fallback: Rule-based keyword extraction when model confidence < threshold.
"""
from __future__ import annotations

import re
import math
from dataclasses import dataclass, field
from typing import Optional

import torch
import torch.nn as nn
from transformers import DistilBertModel, DistilBertTokenizerFast

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

# ── Label mapping ─────────────────────────────────────────────────────────────
NEED_TYPES = ["food", "medical", "shelter", "education", "water"]
LABEL2IDX  = {l: i for i, l in enumerate(NEED_TYPES)}
IDX2LABEL  = {i: l for l, i in LABEL2IDX.items()}

# ── Rule-based keyword maps ───────────────────────────────────────────────────
KEYWORD_MAP: dict[str, list[str]] = {
    "food":      ["food", "starving", "hunger", "hungry", "eat", "meal", "nutrition", "famine"],
    "medical":   ["medical", "sick", "hospital", "injury", "medicine", "doctor", "health", "disease", "wound"],
    "shelter":   ["shelter", "homeless", "house", "roof", "displaced", "flood", "camp", "housing"],
    "education": ["school", "students", "education", "teacher", "class", "learning", "books", "study"],
    "water":     ["water", "drinking", "sanitation", "hygiene", "well", "drought", "thirst"],
}

URGENCY_KEYWORDS = ["urgent", "critical", "emergency", "immediately", "severe", "crisis", "danger", "life"]


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class StructuredOutput:
    need_type:           Optional[str]
    urgency_score:       float          # 0.0 – 1.0
    confidence_need_type: float
    confidence_urgency:  float
    used_fallback_need:  bool = False
    used_fallback_urgency: bool = False
    is_flagged_review:   bool = False


# ── Model architecture ────────────────────────────────────────────────────────
class NLPModel(nn.Module):
    """
    DistilBERT with two heads:
      - classification head → need_type (5 classes)
      - regression head     → urgency_score (0–1)
    """

    def __init__(self, num_classes: int = 5):
        super().__init__()
        self.encoder = DistilBertModel.from_pretrained(config.NLP_MODEL_NAME)
        hidden = self.encoder.config.hidden_size  # 768

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, num_classes),
        )

        # Regression head
        self.regressor = nn.Sequential(
            nn.Linear(hidden, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 1),
            nn.Sigmoid(),   # output in [0, 1]
        )

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        # Use [CLS] token representation
        cls = outputs.last_hidden_state[:, 0, :]
        logits   = self.classifier(cls)
        urgency  = self.regressor(cls).squeeze(-1)
        return logits, urgency


# ── Singleton model loader ────────────────────────────────────────────────────
_tokenizer: Optional[DistilBertTokenizerFast] = None
_model:     Optional[NLPModel]                = None
_device:    torch.device                      = torch.device("cpu")


def _load_model() -> tuple[DistilBertTokenizerFast, NLPModel]:
    global _tokenizer, _model
    if _tokenizer is None:
        _tokenizer = DistilBertTokenizerFast.from_pretrained(config.NLP_MODEL_NAME)
    if _model is None:
        _model = NLPModel(num_classes=len(NEED_TYPES))
        # Load fine-tuned weights if available
        weights_path = config.MODEL_DIR / "nlp_model.pt"
        if weights_path.exists():
            _model.load_state_dict(torch.load(weights_path, map_location=_device))
        _model.to(_device)
        _model.eval()
    return _tokenizer, _model


# ── Preprocessing ─────────────────────────────────────────────────────────────
def preprocess(text: str) -> dict:
    """Lowercase, strip, tokenize."""
    cleaned = re.sub(r"\s+", " ", text.lower().strip())
    tokenizer, _ = _load_model()
    return tokenizer(
        cleaned,
        max_length=config.NLP_MAX_LENGTH,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )


# ── Rule-based fallback ───────────────────────────────────────────────────────
def rule_based_extract(text: str) -> dict:
    """
    Returns:
      need_type:     best keyword-matched category or None
      urgency_score: fraction of urgency keywords found (0.0–1.0)
      confidence:    simple heuristic confidence
    """
    lower = text.lower()

    # Need type: count keyword hits per category
    scores = {cat: sum(1 for kw in kws if kw in lower) for cat, kws in KEYWORD_MAP.items()}
    best_cat   = max(scores, key=scores.get)
    best_score = scores[best_cat]
    need_type  = best_cat if best_score > 0 else None
    need_conf  = min(best_score / 3.0, 1.0) if best_score > 0 else 0.0

    # Urgency: count urgency keywords
    urgency_hits  = sum(1 for kw in URGENCY_KEYWORDS if kw in lower)
    urgency_score = min(urgency_hits / len(URGENCY_KEYWORDS), 1.0)
    urgency_conf  = min(urgency_hits / 2.0, 1.0)

    return {
        "need_type":      need_type,
        "urgency_score":  urgency_score,
        "need_conf":      need_conf,
        "urgency_conf":   urgency_conf,
    }


# ── Model inference ───────────────────────────────────────────────────────────
def _predict_raw(text: str) -> dict:
    """Run model inference; return raw logits, probabilities, urgency."""
    tokenizer, model = _load_model()
    inputs = preprocess(text)
    input_ids      = inputs["input_ids"].to(_device)
    attention_mask = inputs["attention_mask"].to(_device)

    with torch.no_grad():
        logits, urgency = model(input_ids, attention_mask)

    probs      = torch.softmax(logits, dim=-1).squeeze(0)
    top_prob, top_idx = probs.max(dim=0)

    return {
        "need_type":      IDX2LABEL[top_idx.item()],
        "need_conf":      top_prob.item(),
        "urgency_score":  urgency.item(),
        "urgency_conf":   1.0,   # regression head always produces a value
    }


# ── Main entry point ──────────────────────────────────────────────────────────
def process_report(text: str) -> StructuredOutput:
    """
    Full processing pipeline:
    1. Run NLP model
    2. For any field with confidence < threshold, apply rule-based fallback
    3. If both fail, set field to None and flag for review
    """
    threshold = config.NLP_CONFIDENCE_THRESHOLD

    model_result   = _predict_raw(text)
    fallback_result = rule_based_extract(text)

    # ── need_type ──────────────────────────────────────────────────────────────
    used_fallback_need = False
    if model_result["need_conf"] >= threshold:
        need_type      = model_result["need_type"]
        need_conf      = model_result["need_conf"]
    else:
        used_fallback_need = True
        need_type      = fallback_result["need_type"]
        need_conf      = fallback_result["need_conf"]

    # ── urgency_score ──────────────────────────────────────────────────────────
    used_fallback_urgency = False
    if model_result["urgency_conf"] >= threshold:
        urgency_score  = model_result["urgency_score"]
        urgency_conf   = model_result["urgency_conf"]
    else:
        used_fallback_urgency = True
        urgency_score  = fallback_result["urgency_score"]
        urgency_conf   = fallback_result["urgency_conf"]

    # ── Flag for review if both methods failed ─────────────────────────────────
    is_flagged = (need_type is None) or (urgency_conf == 0.0 and urgency_score == 0.0)

    # Clamp urgency to [0, 1]
    urgency_score = max(0.0, min(1.0, urgency_score))

    return StructuredOutput(
        need_type=need_type,
        urgency_score=urgency_score,
        confidence_need_type=need_conf,
        confidence_urgency=urgency_conf,
        used_fallback_need=used_fallback_need,
        used_fallback_urgency=used_fallback_urgency,
        is_flagged_review=is_flagged,
    )
