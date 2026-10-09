from uuid import UUID

from pydantic import BaseModel, Field


class ProjectStructureAnalysisRequest(BaseModel):
    provider_id: UUID
    model_id: UUID
    options: dict = Field(default_factory=dict)


class ProjectFeature(BaseModel):
    name: str
    purpose: str
    files: list[str]
    related_features: list[str] = Field(default_factory=list)


class ProjectStructureAnalysisResponse(BaseModel):
    project_id: UUID
    provider_id: UUID
    model_id: UUID
    summary: str
    tree: str
    technologies: list[str]
    features: list[ProjectFeature]
