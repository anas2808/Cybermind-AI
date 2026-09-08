from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)