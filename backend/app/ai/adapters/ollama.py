import time
from typing import Any

import httpx

from app.ai.gateway import AIAnalysisRequest, AIAnalysisResponse, AIProviderAdapter, AIUsage


class OllamaAdapter(AIProviderAdapter):
    provider_type = "ollama"

    async def test_connection(
        self, endpoint: str, credentials: dict[str, str] | None
    ) -> tuple[str, int | None]:
        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{endpoint.rstrip('/')}/api/tags")
            response.raise_for_status()
        latency_ms = int((time.perf_counter() - started) * 1000)
        return "connected", latency_ms

    async def discover_models(
        self, endpoint: str, credentials: dict[str, str] | None
    ) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{endpoint.rstrip('/')}/api/tags")
            response.raise_for_status()
            payload = response.json()

        return [
            {
                "model_id": item.get("name", ""),
                "display_name": item.get("name", ""),
                "context_window": None,
                "max_output_tokens": None,
                "capabilities": {},
                "limits": {},
                "availability": "available",
                "metadata_json": item,
            }
            for item in payload.get("models", [])
            if item.get("name")
        ]

    async def analyze(
        self,
        endpoint: str,
        credentials: dict[str, str] | None,
        request: AIAnalysisRequest,
    ) -> AIAnalysisResponse:
        prompt = (
            f"{request.system_prompt}\n\n"
            f"Security context:\n{request.context}\n\n"
            f"{request.user_prompt}"
        )
        started = time.perf_counter()

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{endpoint.rstrip('/')}/api/generate",
                json={
                    "model": request.model_id,
                    "prompt": prompt,
                    "stream": False,
                    **(request.options or {}),
                },
            )
            response.raise_for_status()
            payload = response.json()

        duration_ms = int((time.perf_counter() - started) * 1000)
        usage = AIUsage(
            input_tokens=payload.get("prompt_eval_count"),
            output_tokens=payload.get("eval_count"),
            total_tokens=(
                (payload.get("prompt_eval_count") or 0)
                + (payload.get("eval_count") or 0)
            )
            if payload.get("prompt_eval_count") is not None
            or payload.get("eval_count") is not None
            else None,
        )
        return AIAnalysisResponse(
            content=payload.get("response", ""),
            model_id=request.model_id,
            usage=usage,
            finish_reason=payload.get("done_reason"),
            duration_ms=duration_ms,
        )
