import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit

import httpx
import httpcore
from httpcore._backends.auto import AutoBackend

from app.core.config import settings


class ProviderEndpointError(ValueError):
    """Raised when a provider endpoint is unsafe or cannot be resolved safely."""


@dataclass(frozen=True)
class ValidatedEndpoint:
    url: str
    parsed: SplitResult
    addresses: tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...]


def _resolve_addresses(parsed: SplitResult) -> tuple[
    ipaddress.IPv4Address | ipaddress.IPv6Address, ...
]:
    host = parsed.hostname or ""
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        return (literal,)

    try:
        resolved = socket.getaddrinfo(
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
    return addresses


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


def _validate_addresses(
    addresses: tuple[ipaddress.IPv4Address | ipaddress.IPv6Address, ...],
    local_ollama: bool,
) -> None:
    if not local_ollama and any(_blocked_address(address) for address in addresses):
        raise ProviderEndpointError("Provider endpoint resolves to a prohibited network")
    if local_ollama and any(not address.is_loopback for address in addresses):
        raise ProviderEndpointError("Local Ollama endpoint must resolve to loopback")


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
    addresses = await asyncio.to_thread(_resolve_addresses, parsed)

    _validate_addresses(addresses, local_ollama)

    return ValidatedEndpoint(
        url=endpoint.strip().rstrip("/"),
        parsed=parsed,
        addresses=addresses,
    )


class _PinnedNetworkBackend(httpcore.AsyncNetworkBackend):
    """Resolve and validate a provider hostname before connecting to its IP."""

    def __init__(self, endpoint: str, provider_type: str):
        self._parsed = _parse_endpoint(endpoint)
        self._provider_type = provider_type
        self._port = self._parsed.port or (
            443 if self._parsed.scheme == "https" else 80
        )
        self._local_ollama = (
            provider_type.strip().lower() == "ollama"
            and _is_local_ollama_host(self._parsed.hostname or "")
        )
        self._backend = AutoBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options=None,
    ):
        configured_host = (self._parsed.hostname or "").rstrip(".").lower()
        if host.rstrip(".").lower() != configured_host or port != self._port:
            raise ProviderEndpointError(
                "Provider request destination does not match the configured endpoint"
            )
        if self._local_ollama and not settings.ALLOW_LOCAL_OLLAMA:
            raise ProviderEndpointError("Local Ollama access is disabled")

        addresses = await asyncio.to_thread(_resolve_addresses, self._parsed)
        _validate_addresses(addresses, self._local_ollama)
        return await self._backend.connect_tcp(
            str(addresses[0]),
            self._port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )

    async def connect_unix_socket(self, path: str, timeout: float | None = None, socket_options=None):
        raise ProviderEndpointError("Unix socket provider endpoints are not permitted")

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class _PinnedHTTPTransport(httpx.AsyncHTTPTransport):
    def __init__(self, endpoint: str, provider_type: str):
        super().__init__(trust_env=False, retries=0)
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=self._pool._ssl_context,
            max_connections=100,
            max_keepalive_connections=20,
            keepalive_expiry=5.0,
            retries=0,
            network_backend=_PinnedNetworkBackend(endpoint, provider_type),
        )


class ProtectedAsyncClient:
    """HTTPX client that pins each connection to a validated destination IP."""

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
        if transport is None:
            transport = _PinnedHTTPTransport(endpoint, provider_type)
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            follow_redirects=False,
            trust_env=False,
            transport=_ProtectedTransport(transport, endpoint, provider_type),
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
