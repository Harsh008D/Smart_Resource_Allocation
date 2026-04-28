"""
NLP Router — POST /ai/process
Accepts raw report text and returns structured fields.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from nlp.engine import process_report, StructuredOutput

router = APIRouter(tags=["NLP"])


class ProcessRequest(BaseModel):
    report_id: Optional[str] = None
    text: str


class ProcessResponse(BaseModel):
    report_id:            Optional[str]
    need_type:            Optional[str]
    urgency_score:        float
    confidence_need_type: float
    confidence_urgency:   float
    used_fallback_need:   bool
    used_fallback_urgency: bool
    is_flagged_review:    bool


@router.post("/process", response_model=ProcessResponse)
def process(req: ProcessRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text field is required and must not be empty")

    result: StructuredOutput = process_report(req.text)

    return ProcessResponse(
        report_id=req.report_id,
        need_type=result.need_type,
        urgency_score=result.urgency_score,
        confidence_need_type=result.confidence_need_type,
        confidence_urgency=result.confidence_urgency,
        used_fallback_need=result.used_fallback_need,
        used_fallback_urgency=result.used_fallback_urgency,
        is_flagged_review=result.is_flagged_review,
    )
