from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CodeReviewRequest(BaseModel):
    provider_id: UUID
    model_id: UUID
    language: str = Field(default="auto-detect", min_length=1, max_length=80)
    code: str = Field(min_length=1, max_length=60000)
    review_focus: list[Literal["security", "bugs", "quality", "performance"]] = Field(
        default_factory=lambda: ["security", "bugs", "quality"]
    )


class CodeReviewFinding(BaseModel):
    title: str
    severity: Literal["critical", "high", "medium", "low", "informational"]
    category: str
    line: int | None = None
    evidence: str
    explanation: str
    recommendation: str


class CodeReviewResponse(BaseModel):
    provider_id: UUID
    model_id: UUID
    language: str
    summary: str
    findings: list[CodeReviewFinding]
    limitations: list[str] = Field(default_factory=list)
