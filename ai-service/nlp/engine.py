"""
NLP Processing Engine
─────────────────────
Primary:  DistilBERT (if torch is available)
Fallback: Rule-based keyword extraction (always available, used in production)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# ── Label mapping ─────────────────────────────────────────────────────────────
NEED_TYPES = ["food", "medical", "shelter", "education", "water"]

# ── Rule-based keyword maps ───────────────────────────────────────────────────
KEYWORD_MAP: dict[str, list[str]] = {
    "food":      ["food", "starving", "hunger", "hungry", "eat", "meal", "nutrition", "famine", "ration"],
    "medical":   ["medical", "sick", "hospital", "injury", "medicine", "doctor", "health", "disease", "wound", "injured", "emergency"],
    "shelter":   ["shelter", "homeless", "house", "roof", "displaced", "flood", "camp", "housing", "accommodation"],
    "education": ["school", "students", "education", "teacher", "class", "learning", "books", "study", "college"],
    "water":     ["water", "drinking", "sanitation", "hygiene", "well", "drought", "thirst", "clean water"],
}

URGENCY_KEYWORDS = ["urgent", "critical", "emergency", "immediately", "severe", "crisis", "danger", "life", "dying", "death", "help"]


# ── Data classes ──────────────────────────────────────────────────────────────
@dataclass
class StructuredOutput:
    need_type:            Optional[str]
    urgency_score:        float
    confidence_need_type: float
    confidence_urgency:   float
    used_fallback_need:   bool = True
    used_fallback_urgency: bool = True
    is_flagged_review:    bool = False


# ── Rule-based extraction (always available) ──────────────────────────────────
def rule_based_extract(text: str) -> dict:
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
    # Base urgency from text length and intensity words
    if urgency_score == 0.0:
        urgency_score = 0.4  # default moderate urgency
    urgency_conf  = min(urgency_hits / 2.0, 1.0) if urgency_hits > 0 else 0.5

    return {
        "need_type":      need_type,
        "urgency_score":  urgency_score,
        "need_conf":      need_conf,
        "urgency_conf":   urgency_conf,
    }


# ── Try to load torch/transformers (optional) ─────────────────────────────────
_torch_available = False
_tokenizer = None
_model = None

try:
    import torch
    import torch.nn as nn
    from transformers import DistilBertModel, DistilBertTokenizerFast
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    import config as _config

    _torch_available = True

    class _NLPModel(nn.Module):
        def __init__(self, num_classes: int = 5):
            super().__init__()
            self.encoder = DistilBertModel.from_pretrained(_config.NLP_MODEL_NAME)
            hidden = self.encoder.config.hidden_size
            self.classifier = nn.Sequential(nn.Linear(hidden, 256), nn.ReLU(), nn.Dropout(0.1), nn.Linear(256, num_classes))
            self.regressor  = nn.Sequential(nn.Linear(hidden, 128), nn.ReLU(), nn.Dropout(0.1), nn.Linear(128, 1), nn.Sigmoid())

        def forward(self, input_ids, attention_mask):
            out = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
            cls = out.last_hidden_state[:, 0, :]
            return self.classifier(cls), self.regressor(cls).squeeze(-1)

    def _load_model():
        global _tokenizer, _model
        if _tokenizer is None:
            _tokenizer = DistilBertTokenizerFast.from_pretrained(_config.NLP_MODEL_NAME)
        if _model is None:
            _model = _NLPModel(num_classes=len(NEED_TYPES))
            weights_path = _config.MODEL_DIR / "nlp_model.pt"
            if weights_path.exists():
                _model.load_state_dict(torch.load(weights_path, map_location="cpu"))
            _model.eval()
        return _tokenizer, _model

    IDX2LABEL = {i: l for i, l in enumerate(NEED_TYPES)}

    def _predict_raw(text: str) -> dict:
        tokenizer, model = _load_model()
        cleaned = re.sub(r"\s+", " ", text.lower().strip())
        inputs = tokenizer(cleaned, max_length=128, padding="max_length", truncation=True, return_tensors="pt")
        with torch.no_grad():
            logits, urgency = model(inputs["input_ids"], inputs["attention_mask"])
        probs = torch.softmax(logits, dim=-1).squeeze(0)
        top_prob, top_idx = probs.max(dim=0)
        return {
            "need_type":     IDX2LABEL[top_idx.item()],
            "need_conf":     top_prob.item(),
            "urgency_score": urgency.item(),
            "urgency_conf":  1.0,
        }

except Exception:
    _torch_available = False


# ── Main entry point ──────────────────────────────────────────────────────────
def process_report(text: str) -> StructuredOutput:
    threshold = 0.6

    # Try NLP model first if available
    if _torch_available:
        try:
            model_result = _predict_raw(text)
            fallback_result = rule_based_extract(text)

            used_fallback_need = model_result["need_conf"] < threshold
            used_fallback_urgency = model_result["urgency_conf"] < threshold

            need_type     = fallback_result["need_type"] if used_fallback_need else model_result["need_type"]
            need_conf     = fallback_result["need_conf"] if used_fallback_need else model_result["need_conf"]
            urgency_score = fallback_result["urgency_score"] if used_fallback_urgency else model_result["urgency_score"]
            urgency_conf  = fallback_result["urgency_conf"] if used_fallback_urgency else model_result["urgency_conf"]

            urgency_score = max(0.0, min(1.0, urgency_score))
            return StructuredOutput(
                need_type=need_type, urgency_score=urgency_score,
                confidence_need_type=need_conf, confidence_urgency=urgency_conf,
                used_fallback_need=used_fallback_need, used_fallback_urgency=used_fallback_urgency,
                is_flagged_review=(need_type is None),
            )
        except Exception:
            pass  # fall through to rule-based

    # Rule-based only (production default)
    result = rule_based_extract(text)
    urgency = max(0.0, min(1.0, result["urgency_score"]))
    return StructuredOutput(
        need_type=result["need_type"],
        urgency_score=urgency,
        confidence_need_type=result["need_conf"],
        confidence_urgency=result["urgency_conf"],
        used_fallback_need=True,
        used_fallback_urgency=True,
        is_flagged_review=(result["need_type"] is None),
    )
