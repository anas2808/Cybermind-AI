import json
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from gitingest import ingest_async
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.gateway import AIAnalysisRequest
from app.models.ai_provider import AIModel, AIProvider
from app.models.projects import Project
from app.models.user import User
from app.services.ai_provider import decrypt_credentials, gateway


async def analyze_project_structure(
    db: Session,
    project: Project,
    current_user,
    provider_id: UUID,
    model_id: UUID,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not project.repository_url:
        raise HTTPException(status_code=400, detail='Project repository URL is not configured')

    provider = db.execute(
        select(AIProvider)
        .join(User, AIProvider.owner_id == User.id)
        .where(AIProvider.id == provider_id, User.auth_user_id == current_user.id, AIProvider.enabled.is_(True))
    ).scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail='AI provider not found')

    model = db.execute(
        select(AIModel)
        .join(AIProvider, AIModel.provider_id == AIProvider.id)
        .join(User, AIProvider.owner_id == User.id)
        .where(AIModel.id == model_id, AIModel.provider_id == provider_id, User.auth_user_id == current_user.id)
    ).scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail='AI model not found')

    try:
        summary, tree, _content = await ingest_async(project.repository_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail='GitIngest could not read the configured repository') from exc

    system_prompt = (
        'Analyze the supplied repository structure for a cybersecurity project. '
        'Use only evidence present in the repository summary and directory tree. '
        'Do not invent files, technologies, or features. Preserve file paths exactly. '
        'Return JSON only with keys technologies and features. Each feature must have name, purpose, files, and related_features. '
        'Group files into a small, practical set of application features. '
        'If a file cannot be confidently classified, do not force it into a feature.'
    )
    context = f'Repository summary:\\n{summary}\\n\\nDirectory tree:\\n{tree}'

    adapter = gateway.get_adapter(provider.provider_type)
    try:
        response = await adapter.analyze(
            provider.endpoint,
            decrypt_credentials(provider),
            AIAnalysisRequest(
                model_id=model.model_id,
                system_prompt=system_prompt,
                user_prompt='Map this repository into a simple feature-oriented structure.',
                context=context,
                options=options or {},
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail='Selected AI model could not analyze the repository structure') from exc

    parsed = _parse_structure_response(response.content, tree)
    return {'project_id': project.id, 'provider_id': provider.id, 'model_id': model.id, 'summary': summary, 'tree': tree, **parsed}


def _parse_structure_response(content: str, tree: str) -> dict[str, Any]:
    raw = content.strip()
    if raw.startswith('```'):
        parts = raw.split('\n', 1)
        raw = parts[1] if len(parts) == 2 else raw
        if raw.endswith('```'):
            raw = raw[:-3].rstrip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail='AI returned an invalid project structure response') from exc

    technologies = [value.strip() for value in payload.get('technologies', []) if isinstance(value, str) and value.strip()]
    features: list[dict[str, Any]] = []
    for item in payload.get('features', []):
        if not isinstance(item, dict):
            continue
        files = [path.strip() for path in item.get('files', []) if isinstance(path, str) and path.strip() and path.strip() in tree]
        if not files:
            continue
        features.append({
            'name': str(item.get('name', 'Unclassified feature')).strip(),
            'purpose': str(item.get('purpose', '')).strip(),
            'files': list(dict.fromkeys(files)),
            'related_features': [value.strip() for value in item.get('related_features', []) if isinstance(value, str) and value.strip()],
        })
    return {'technologies': list(dict.fromkeys(technologies)), 'features': features}