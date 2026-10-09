from uuid import UUID

from pydantic import BaseModel, Field


class FeatureSecurityAnalysisRequest(BaseModel):
    provider_id: UUID
    model_id: UUID
    feature_name: str = Field(min_length=1, max_length=255)
    files: list[str] = Field(min_length=1, max_length=100)


class SecurityFinding(BaseModel):
    title: str
    severity: str
    description: str
    evidence: str
    recommendation: str


class FeatureSecurityAnalysisResponse(BaseModel):
    project_id: UUID
    provider_id: UUID
    model_id: UUID
    feature_name: str
    files: list[str]
    findings: list[SecurityFinding]
