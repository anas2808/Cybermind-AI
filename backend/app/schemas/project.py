from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    repository_url: str | None = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    repository_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
