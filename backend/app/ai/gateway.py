from dataclasses import dataclass
from typing import Any


@dataclass
class AIAnalysisRequest:
    model_id: str
    system_prompt: str
    user_prompt: str
    context: str
    options: dict[str, Any] | None = None


@dataclass
class AIUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    estimated: bool = False


@dataclass
class AIAnalysisResponse:
    content: str
    model_id: str
    usage: AIUsage
    finish_reason: str | None = None
    duration_ms: int | None = None


class AIProviderAdapter:
    provider_type: str

    async def test_connection(self, endpoint: str, credentials: dict[str, str] | None) -> tuple[str, int | None]:
        raise NotImplementedError

    async def discover_models(
        self, endpoint: str, credentials: dict[str, str] | None
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    async def analyze(
        self,
        endpoint: str,
        credentials: dict[str, str] | None,
        request: AIAnalysisRequest,
    ) -> AIAnalysisResponse:
        raise NotImplementedError


class AIGateway:
    def __init__(self, adapters: list[AIProviderAdapter]):
        self._adapters = {adapter.provider_type: adapter for adapter in adapters}

    def get_adapter(self, provider_type: str) -> AIProviderAdapter:
        adapter = self._adapters.get(provider_type)
        if not adapter:
            raise ValueError(f"Unsupported AI provider type: {provider_type}")
        return adapter
