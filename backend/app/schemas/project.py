from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def validate_repository_url(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or parsed.hostname not in {"github.com", "www.github.com"}:
        raise ValueError("Only public HTTPS GitHub repository URLs are supported")
    return value.strip().rstrip("/")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    repository_url: str | None = None

    _validate_repository_url = field_validator("repository_url")(validate_repository_url)


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    repository_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
