import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit

import httpx

from app.core.config import settings


class ProviderEndpointError(ValueError):
    """Raised when a provider endpoint is unsafe or cannot be resolved safely."""


@dataclass(frozen=True)
class ValidatedEndpoint:
    url: str
    parsed: SplitResult
    addresses: tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...]


def _is_local_ollama_host(host: str) -> bool:
    normalized = host.rstrip(".").lower()
    if normalized == "localhost":
        return True
    try:
        address = ipaddress.ip_address(normalized)
    except ValueError:
        return False
    return address.is_loopback


def _blocked_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        address.is_loopback
        or address.is_private
        or address.is_link_local
        or address.is_reserved
        or address.is_unspecified
        or address.is_multicast
        or not address.is_global
    )


def _parse_endpoint(endpoint: str) -> SplitResult:
    if not isinstance(endpoint, str):
        raise ProviderEndpointError("Provider endpoint must be a URL")
    try:
        parsed = urlsplit(endpoint.strip())
        host = parsed.hostname
    except ValueError as exc:
        raise ProviderEndpointError("Provider endpoint is malformed") from exc
    if not host or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment:
        raise ProviderEndpointError("Provider endpoint is malformed")
    try:
        parsed.port
    except ValueError as exc:
        raise ProviderEndpointError("Provider endpoint is malformed") from exc
    return parsed


async def validate_provider_endpoint(
    endpoint: str,
    provider_type: str,
) -> ValidatedEndpoint:
    parsed = _parse_endpoint(endpoint)
    normalized_type = provider_type.strip().lower()
    local_ollama = normalized_type == "ollama" and _is_local_ollama_host(parsed.hostname or "")

    if parsed.scheme != "https":
        if not (
            local_ollama
            and parsed.scheme == "http"
            and settings.ALLOW_LOCAL_OLLAMA
        ):
            raise ProviderEndpointError("Provider endpoint must use HTTPS")
    if local_ollama and not settings.ALLOW_LOCAL_OLLAMA:
        raise ProviderEndpointError("Local Ollama access is disabled")

    host = parsed.hostname or ""
    if host.rstrip(".").lower() in {
        "metadata",
        "metadata.google.internal",
        "instance-data.ec2.internal",
    }:
        raise ProviderEndpointError("Provider endpoint is prohibited")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        addresses = (literal,)
    else:
        try:
            resolved = await asyncio.to_thread(
                socket.getaddrinfo,
                host,
                parsed.port,
                type=socket.SOCK_STREAM,
            )
        except (OSError, ValueError) as exc:
            raise ProviderEndpointError("Provider endpoint could not be resolved") from exc
        addresses = tuple(
            dict.fromkeys(
                ipaddress.ip_address(item[4][0])
                for item in resolved
                if item[4] and item[4][0]
            )
        )
        if not addresses:
            raise ProviderEndpointError("Provider endpoint could not be resolved")

    if not local_ollama and any(_blocked_address(address) for address in addresses):
        raise ProviderEndpointError("Provider endpoint resolves to a prohibited network")
    if local_ollama and any(not address.is_loopback for address in addresses):
        raise ProviderEndpointError("Local Ollama endpoint must resolve to loopback")

    return ValidatedEndpoint(
        url=endpoint.strip().rstrip("/"),
        parsed=parsed,
        addresses=addresses,
    )


class ProtectedAsyncClient:
    """HTTPX client that revalidates the destination immediately before sending."""

    def __init__(
        self,
        endpoint: str,
        provider_type: str,
        timeout: float,
        credentials: dict[str, str] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._endpoint = endpoint
        self._provider_type = provider_type
        base_transport = transport or httpx.AsyncHTTPTransport(retries=0)
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            follow_redirects=False,
            trust_env=False,
            transport=_ProtectedTransport(base_transport, endpoint, provider_type),
        )

    async def __aenter__(self) -> "ProtectedAsyncClient":
        await validate_provider_endpoint(self._endpoint, self._provider_type)
        await self._client.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_value, traceback) -> None:
        await self._client.__aexit__(exc_type, exc_value, traceback)

    async def _send(self, method: str, url: str, **kwargs) -> httpx.Response:
        endpoint = await validate_provider_endpoint(self._endpoint, self._provider_type)
        request = urlsplit(url)
        if (
            request.scheme != endpoint.parsed.scheme
            or request.hostname != endpoint.parsed.hostname
            or request.port != endpoint.parsed.port
        ):
            raise ProviderEndpointError("Provider request destination does not match the configured endpoint")
        await validate_provider_endpoint(url, self._provider_type)
        response = await self._client.request(method, url, **kwargs)
        if 300 <= response.status_code < 400 and response.headers.get("location"):
            raise ProviderEndpointError("Provider redirects are not permitted")
        return response

    async def get(self, url: str, **kwargs) -> httpx.Response:
        return await self._send("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> httpx.Response:
        return await self._send("POST", url, **kwargs)


class _ProtectedTransport(httpx.AsyncBaseTransport):
    def __init__(
        self,
        transport: httpx.AsyncBaseTransport,
        endpoint: str,
        provider_type: str,
    ):
        self._transport = transport
        self._endpoint = endpoint
        self._provider_type = provider_type

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        await validate_provider_endpoint(self._endpoint, self._provider_type)
        await validate_provider_endpoint(str(request.url), self._provider_type)
        return await self._transport.handle_async_request(request)

    async def aclose(self) -> None:
        await self._transport.aclose()
