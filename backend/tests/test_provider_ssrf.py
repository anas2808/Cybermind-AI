import os
import socket
import unittest
from unittest.mock import patch
from types import SimpleNamespace

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")

import httpx
from fastapi import HTTPException

from app.ai.adapters.openai_compatible import OpenAICompatibleAdapter
from app.ai.outbound import (
    ProtectedAsyncClient,
    ProviderEndpointError,
    _PinnedNetworkBackend,
    validate_provider_endpoint,
)
from app.core import config
from app.services.ai_provider import get_owned_provider


def resolved(*addresses: str):
    return [
        (
            socket.AF_INET6 if ":" in address else socket.AF_INET,
            socket.SOCK_STREAM,
            6,
            "",
            (address, 443),
        )
        for address in addresses
    ]


class ProviderEndpointPolicyTests(unittest.IsolatedAsyncioTestCase):
    async def assert_rejected(self, endpoint: str, provider_type: str = "openai_compatible"):
        with self.assertRaises(ProviderEndpointError):
            await validate_provider_endpoint(endpoint, provider_type)

    async def test_rejects_prohibited_literal_addresses(self):
        for endpoint in (
            "http://localhost:11434",
            "https://127.0.0.1",
            "https://10.0.0.1",
            "https://172.16.0.1",
            "https://192.168.1.1",
            "https://169.254.169.254",
            "https://[::1]",
            "https://[fe80::1]",
        ):
            await self.assert_rejected(endpoint)

    async def test_rejects_malformed_and_credential_bearing_urls(self):
        for endpoint in (
            "not a url",
            "ftp://public.example",
            "https://user:password@public.example",
            "https://public.example:bad",
            "https://metadata.google.internal",
        ):
            await self.assert_rejected(endpoint)

    async def test_rejects_hostname_resolving_to_private_address(self):
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("192.168.10.10"),
        ):
            await self.assert_rejected("https://provider.example")

    async def test_rejects_dns_rebinding_on_second_validation(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, json={}, request=request)
        )
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            side_effect=[resolved("93.184.216.34"), resolved("127.0.0.1")],
        ):
            async with ProtectedAsyncClient(
                "https://provider.example",
                "openai_compatible",
                2,
                transport=transport,
            ) as client:
                with self.assertRaises(ProviderEndpointError):
                    await client.get("https://provider.example/models")

    async def test_actual_connection_is_pinned_to_validated_ipv4(self):
        class RecordingBackend:
            def __init__(self):
                self.connection = None

            async def connect_tcp(self, host, port, **kwargs):
                self.connection = (host, port)
                return object()

            async def sleep(self, seconds):
                return None

        recording = RecordingBackend()
        backend = _PinnedNetworkBackend("https://provider.example", "openai_compatible")
        backend._backend = recording
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("93.184.216.34"),
        ):
            stream = await backend.connect_tcp("provider.example", 443)
        self.assertIsNotNone(stream)
        self.assertEqual(recording.connection, ("93.184.216.34", 443))

    async def test_actual_connection_is_pinned_to_validated_ipv6(self):
        class RecordingBackend:
            async def connect_tcp(self, host, port, **kwargs):
                self.connection = (host, port)
                return object()

            async def sleep(self, seconds):
                return None

        recording = RecordingBackend()
        backend = _PinnedNetworkBackend("https://provider.example", "openai_compatible")
        backend._backend = recording
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("2606:4700:4700::1111"),
        ):
            await backend.connect_tcp("provider.example", 443)
        self.assertEqual(recording.connection, ("2606:4700:4700::1111", 443))

    async def test_mixed_public_and_private_dns_answers_never_connect(self):
        class RecordingBackend:
            def __init__(self):
                self.called = False

            async def connect_tcp(self, host, port, **kwargs):
                self.called = True
                return object()

            async def sleep(self, seconds):
                return None

        recording = RecordingBackend()
        backend = _PinnedNetworkBackend("https://provider.example", "openai_compatible")
        backend._backend = recording
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("93.184.216.34", "10.0.0.8"),
        ):
            with self.assertRaises(ProviderEndpointError):
                await backend.connect_tcp("provider.example", 443)
        self.assertFalse(recording.called)

    async def test_rebinding_to_private_address_is_blocked_at_connection(self):
        class RecordingBackend:
            def __init__(self):
                self.connections = []

            async def connect_tcp(self, host, port, **kwargs):
                self.connections.append((host, port))
                return object()

            async def sleep(self, seconds):
                return None

        recording = RecordingBackend()
        backend = _PinnedNetworkBackend("https://provider.example", "openai_compatible")
        backend._backend = recording
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            side_effect=[
                resolved("93.184.216.34"),
                resolved("127.0.0.1"),
            ],
        ):
            await backend.connect_tcp("provider.example", 443)
            with self.assertRaises(ProviderEndpointError):
                await backend.connect_tcp("provider.example", 443)
        self.assertEqual(recording.connections, [("93.184.216.34", 443)])

    async def test_local_ollama_connection_can_only_pin_to_loopback(self):
        class RecordingBackend:
            async def connect_tcp(self, host, port, **kwargs):
                self.connection = (host, port)
                return object()

            async def sleep(self, seconds):
                return None

        recording = RecordingBackend()
        backend = _PinnedNetworkBackend("http://[::1]:11434", "ollama")
        backend._backend = recording
        with patch.object(config.settings, "ALLOW_LOCAL_OLLAMA", True):
            with patch(
                "app.ai.outbound.socket.getaddrinfo",
                return_value=resolved("::1"),
            ):
                await backend.connect_tcp("::1", 11434)
        self.assertEqual(recording.connection, ("::1", 11434))

    async def test_allows_valid_https_endpoint(self):
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("93.184.216.34"),
        ):
            result = await validate_provider_endpoint(
                "https://provider.example/v1", "openai_compatible"
            )
        self.assertEqual(result.url, "https://provider.example/v1")

    async def test_local_ollama_requires_explicit_server_setting(self):
        with patch.object(config.settings, "ALLOW_LOCAL_OLLAMA", False):
            await self.assert_rejected("http://127.0.0.1:11434", "ollama")
        with patch.object(config.settings, "ALLOW_LOCAL_OLLAMA", True):
            result = await validate_provider_endpoint("http://127.0.0.1:11434", "ollama")
        self.assertEqual(result.parsed.hostname, "127.0.0.1")

    async def test_redirect_is_rejected_without_following(self):
        transport = httpx.MockTransport(
            lambda request: httpx.Response(
                302,
                headers={"location": "http://169.254.169.254/latest/meta-data"},
                request=request,
            )
        )
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("93.184.216.34"),
        ):
            async with ProtectedAsyncClient(
                "https://provider.example", "openai_compatible", 2, transport=transport
            ) as client:
                with self.assertRaises(ProviderEndpointError):
                    await client.get("https://provider.example/models")

    async def test_authorization_header_is_scoped_to_provider_request(self):
        requests = []

        def handler(request: httpx.Request):
            requests.append(request)
            return httpx.Response(200, json={"data": []}, request=request)

        transport = httpx.MockTransport(handler)
        with patch(
            "app.ai.outbound.socket.getaddrinfo",
            return_value=resolved("93.184.216.34"),
        ):
            async with ProtectedAsyncClient(
                "https://provider.example", "openai_compatible", 2, transport=transport
            ) as client:
                await client.get(
                    "https://provider.example/models",
                    headers=OpenAICompatibleAdapter._headers({"api_key": "test-secret"}),
                )
        self.assertEqual(requests[0].headers["authorization"], "Bearer test-secret")
        self.assertNotIn("test-secret", "https://provider.example/models")

    async def test_missing_owned_provider_is_rejected(self):
        class EmptyResult:
            def scalar_one_or_none(self):
                return None

        class EmptyDatabase:
            def execute(self, query):
                return EmptyResult()

        with self.assertRaises(HTTPException) as caught:
            get_owned_provider(
                EmptyDatabase(),
                "00000000-0000-0000-0000-000000000000",
                SimpleNamespace(id="user-auth-id"),
            )
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
