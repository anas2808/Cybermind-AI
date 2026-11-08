import time
from typing import Any

from app.ai.gateway import AIAnalysisRequest, AIAnalysisResponse, AIProviderAdapter, AIUsage
from app.ai.outbound import ProtectedAsyncClient


class OpenAICompatibleAdapter(AIProviderAdapter):
    """
    Adapter for services exposing the common OpenAI-compatible REST surface.

    The vendor is intentionally not encoded here. Any compatible service can
    supply its own endpoint and credentials.
    """

    provider_type = "openai_compatible"

    @staticmethod
    def _headers(credentials: dict[str, str] | None) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        api_key = (credentials or {}).get("api_key")
        if api_key:
            headers["Authorization"] = "Bearer " + api_key
        return headers

    async def test_connection(self, endpoint: str, credentials: dict[str, str] | None):
        started = time.perf_counter()
        async with ProtectedAsyncClient(endpoint, self.provider_type, 15, credentials) as client:
            response = await client.get(
                f"{endpoint.rstrip('/')}/models",
                headers=self._headers(credentials),
            )
            response.raise_for_status()
        return "connected", int((time.perf_counter() - started) * 1000)

    async def discover_models(self, endpoint: str, credentials: dict[str, str] | None):
        async with ProtectedAsyncClient(endpoint, self.provider_type, 20, credentials) as client:
            response = await client.get(
                f"{endpoint.rstrip('/')}/models",
                headers=self._headers(credentials),
            )
            response.raise_for_status()
            payload = response.json()

        records = []
        for item in payload.get("data", []):
            model_id = item.get("id")
            if not model_id:
                continue
            records.append({
                "model_id": model_id,
                "display_name": model_id,
                "context_window": item.get("context_window"),
                "max_output_tokens": item.get("max_completion_tokens"),
                "capabilities": {},
                "limits": {},
                "availability": "available",
                "metadata_json": item,
            })
        return records

    async def analyze(
        self,
        endpoint: str,
        credentials: dict[str, str] | None,
        request: AIAnalysisRequest,
    ) -> AIAnalysisResponse:
        started = time.perf_counter()
        payload: dict[str, Any] = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Security context:\n{request.context}\n\n"
                        f"{request.user_prompt}"
                    ),
                },
            ],
        }
        payload.update(request.options or {})

        async with ProtectedAsyncClient(endpoint, self.provider_type, 120, credentials) as client:
            response = await client.post(
                f"{endpoint.rstrip('/')}/chat/completions",
                headers=self._headers(credentials),
                json=payload,
            )
            response.raise_for_status()
            result = response.json()

        choices = result.get("choices") or [{}]
        message = choices[0].get("message") or {}
        usage = result.get("usage") or {}
        return AIAnalysisResponse(
            content=message.get("content", ""),
            model_id=request.model_id,
            usage=AIUsage(
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
            ),
            finish_reason=choices[0].get("finish_reason"),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
