import base64
import json
import time
from datetime import datetime, timezone
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.adapters.ollama import OllamaAdapter
from app.ai.gateway import AIGateway
from app.core.config import settings
from app.models.ai_provider import AIModel, AIProvider
from app.models.user import User


gateway = AIGateway([OllamaAdapter()])


def _get_cipher() -> Fernet:
    if not settings.AI_PROVIDER_ENCRYPTION_KEY:
        raise HTTPException(
            status_code=500,
            detail="AI provider encryption key is not configured",
        )
    try:
        return Fernet(settings.AI_PROVIDER_ENCRYPTION_KEY.encode())
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="AI provider encryption key is invalid",
        ) from exc


def encrypt_credentials(credentials: dict[str, str] | None) -> str | None:
    if not credentials:
        return None
    payload = json.dumps(credentials, separators=(",", ":")).encode()
    return _get_cipher().encrypt(payload).decode()


def decrypt_credentials(provider: AIProvider) -> dict[str, str] | None:
    if not provider.encrypted_credentials:
        return None
    try:
        payload = _get_cipher().decrypt(provider.encrypted_credentials.encode())
        return json.loads(payload.decode())
    except (InvalidToken, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Stored AI provider credentials could not be decrypted",
        ) from exc


def get_owned_provider(
    db: Session, provider_id: UUID, current_user
) -> AIProvider:
    provider = db.execute(
        select(AIProvider)
        .join(User, AIProvider.owner_id == User.id)
        .where(
            AIProvider.id == provider_id,
            User.auth_user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="AI provider not found")
    return provider


def to_model_response(model: AIModel) -> AIModel:
    return model


async def test_provider(db: Session, provider: AIProvider) -> tuple[str, int | None]:
    adapter = gateway.get_adapter(provider.provider_type)
    status, latency = await adapter.test_connection(
        provider.endpoint, decrypt_credentials(provider)
    )
    provider.connection_status = status
    provider.last_tested_at = datetime.now(timezone.utc)
    db.commit()
    return status, latency


async def discover_provider_models(db: Session, provider: AIProvider) -> list[AIModel]:
    adapter = gateway.get_adapter(provider.provider_type)
    models = await adapter.discover_models(
        provider.endpoint, decrypt_credentials(provider)
    )
    db.query(AIModel).filter(AIModel.provider_id == provider.id).delete(
        synchronize_session=False
    )
    now = datetime.now(timezone.utc)
    records = [
        AIModel(
            provider_id=provider.id,
            model_id=item["model_id"],
            display_name=item["display_name"],
            context_window=item.get("context_window"),
            max_output_tokens=item.get("max_output_tokens"),
            capabilities=item.get("capabilities"),
            limits=item.get("limits"),
            availability=item.get("availability", "unknown"),
            metadata_json=item.get("metadata_json"),
            discovered_at=now,
        )
        for item in models
    ]
    db.add_all(records)
    db.commit()
    return records
