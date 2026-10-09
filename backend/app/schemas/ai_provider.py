from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AIProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    provider_type: str = Field(min_length=1, max_length=100)
    endpoint: str = Field(min_length=1)
    auth_type: str = Field(default="none", min_length=1, max_length=50)
    credentials: dict[str, str] | None = None


class AIProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    endpoint: str | None = Field(default=None, min_length=1)
    auth_type: str | None = Field(default=None, min_length=1, max_length=50)
    credentials: dict[str, str] | None = None
    enabled: bool | None = None


class AIProviderResponse(BaseModel):
    id: UUID
    name: str
    provider_type: str
    endpoint: str
    auth_type: str
    enabled: bool
    connection_status: str
    last_tested_at: datetime | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AIModelResponse(BaseModel):
    id: UUID
    provider_id: UUID
    model_id: str
    display_name: str
    context_window: int | None
    max_output_tokens: int | None
    capabilities: dict | None
    limits: dict | None
    availability: str
    metadata_json: dict | None
    discovered_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class ProviderTestResponse(BaseModel):
    provider_id: UUID
    status: str
    message: str
    latency_ms: int | None = None


class ModelDiscoveryResponse(BaseModel):
    provider_id: UUID
    status: str
    models: list[AIModelResponse]
