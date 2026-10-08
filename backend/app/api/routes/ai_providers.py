import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.projects import get_db
from app.models.ai_provider import AIModel, AIProvider
from app.models.user import User
from app.schemas.ai_provider import (
    AIModelResponse,
    AIProviderCreate,
    AIProviderResponse,
    AIProviderUpdate,
    ModelDiscoveryResponse,
    ProviderTestResponse,
)
from app.security.authentication import get_current_user
from app.services.ai_provider import (
    decrypt_credentials,
    discover_provider_models,
    encrypt_credentials,
    get_owned_provider,
    test_provider,
)


router = APIRouter(
    prefix="/api/ai/providers",
    tags=["AI Providers"],
)


def _get_user(db: Session, current_user):
    return db.execute(
        select(User).where(User.auth_user_id == current_user.id)
    ).scalar_one_or_none()


@router.get("/", response_model=list[AIProviderResponse])
async def list_providers(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user)
    if not user:
        return []
    return db.execute(
        select(AIProvider)
        .where(AIProvider.owner_id == user.id)
        .order_by(AIProvider.created_at.desc())
    ).scalars().all()


@router.post("/", response_model=AIProviderResponse)
async def create_provider(
    provider_data: AIProviderCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user)
    if not user:
        user = User(
            auth_user_id=current_user.id,
            email=current_user.email,
            full_name=(
                current_user.user_metadata.get("full_name")
                if current_user.user_metadata
                else None
            ),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    provider = AIProvider(
        owner_id=user.id,
        name=provider_data.name.strip(),
        provider_type=provider_data.provider_type.strip().lower(),
        endpoint=provider_data.endpoint.strip().rstrip("/"),
        auth_type=provider_data.auth_type.strip().lower(),
        encrypted_credentials=encrypt_credentials(provider_data.credentials),
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/{provider_id}", response_model=AIProviderResponse)
async def get_provider(
    provider_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_owned_provider(db, provider_id, current_user)


@router.patch("/{provider_id}", response_model=AIProviderResponse)
async def update_provider(
    provider_id: uuid.UUID,
    provider_data: AIProviderUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = get_owned_provider(db, provider_id, current_user)

    if provider_data.name is not None:
        provider.name = provider_data.name.strip()
    if provider_data.endpoint is not None:
        provider.endpoint = provider_data.endpoint.strip().rstrip("/")
    if provider_data.auth_type is not None:
        provider.auth_type = provider_data.auth_type.strip().lower()
    if provider_data.credentials is not None:
        provider.encrypted_credentials = encrypt_credentials(provider_data.credentials)
    if provider_data.enabled is not None:
        provider.enabled = provider_data.enabled

    provider.connection_status = "unknown"
    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/{provider_id}")
async def delete_provider(
    provider_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = get_owned_provider(db, provider_id, current_user)
    db.delete(provider)
    db.commit()
    return {"message": "AI provider deleted"}


@router.post("/{provider_id}/test", response_model=ProviderTestResponse)
async def test_ai_provider(
    provider_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = get_owned_provider(db, provider_id, current_user)
    if not provider.enabled:
        raise HTTPException(status_code=400, detail="AI provider is disabled")

    started = time.perf_counter()
    try:
        status, adapter_latency = await test_provider(db, provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        provider.connection_status = "failed"
        db.commit()
        raise HTTPException(
            status_code=502,
            detail=f"AI provider connection failed: {exc}",
        ) from exc

    return ProviderTestResponse(
        provider_id=provider.id,
        status=status,
        message="Provider connection successful",
        latency_ms=adapter_latency
        if adapter_latency is not None
        else int((time.perf_counter() - started) * 1000),
    )


@router.post("/{provider_id}/discover-models", response_model=ModelDiscoveryResponse)
async def discover_models(
    provider_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = get_owned_provider(db, provider_id, current_user)
    if not provider.enabled:
        raise HTTPException(status_code=400, detail="AI provider is disabled")

    try:
        models = await discover_provider_models(db, provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Model discovery failed: {exc}",
        ) from exc

    return ModelDiscoveryResponse(
        provider_id=provider.id,
        status="completed",
        models=[AIModelResponse.model_validate(model) for model in models],
    )


@router.get("/{provider_id}/models", response_model=list[AIModelResponse])
async def list_models(
    provider_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = get_owned_provider(db, provider_id, current_user)
    return db.execute(
        select(AIModel)
        .where(AIModel.provider_id == provider.id)
        .order_by(AIModel.display_name)
    ).scalars().all()
