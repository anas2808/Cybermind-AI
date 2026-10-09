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


async def analyze_feature_security(db: Session, project: Project, current_user, provider_id: UUID, model_id: UUID, feature_name: str, files: list[str]) -> dict[str, Any]:
    if not project.repository_url:
        raise HTTPException(status_code=400, detail='Project repository URL is not configured')
    selected_files = list(dict.fromkeys(path.strip() for path in files if path.strip()))
    if not selected_files:
        raise HTTPException(status_code=400, detail='At least one feature file is required')

    provider = db.execute(select(AIProvider).join(User, AIProvider.owner_id == User.id).where(AIProvider.id == provider_id, User.auth_user_id == current_user.id, AIProvider.enabled.is_(True))).scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail='AI provider not found')
    model = db.execute(select(AIModel).join(AIProvider, AIModel.provider_id == AIProvider.id).join(User, AIProvider.owner_id == User.id).where(AIModel.id == model_id, AIModel.provider_id == provider_id, User.auth_user_id == current_user.id)).scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail='AI model not found')

    try:
        _, tree, _ = await ingest_async(project.repository_url)
        tree_paths = _tree_paths(tree)
        invalid = [path for path in selected_files if path not in tree_paths]
        if invalid:
            raise HTTPException(status_code=400, detail=f'Selected file is not present in the repository: {invalid[0]}')
        summary, _, content = await ingest_async(project.repository_url, include_patterns=set(selected_files))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail='GitIngest could not read the selected feature files') from exc

    system_prompt = (
        'Perform a focused security analysis of one application feature. '
        'Use only the supplied GitIngest evidence. Do not invent files, behavior, '
        'vulnerabilities, or runtime facts. Treat uncertain observations as uncertain. '
        'Return JSON only with a findings array. Each finding must contain title, '
        'severity, description, evidence, and recommendation. Severity must be one '
        'of informational, low, medium, high, or critical.'
    )
    context = f'Feature: {feature_name}\nSelected files: {selected_files}\n\nGitIngest summary:\n{summary}\n\nGitIngest content:\n{content}'
    try:
        adapter = gateway.get_adapter(provider.provider_type)
        response = await adapter.analyze(provider.endpoint, decrypt_credentials(provider), AIAnalysisRequest(model_id=model.model_id, system_prompt=system_prompt, user_prompt='Identify concrete security concerns supported by the selected feature files.', context=context, options={}))
    except Exception as exc:
        raise HTTPException(status_code=502, detail='Selected AI model could not analyze the feature') from exc
    return {'project_id': project.id, 'provider_id': provider.id, 'model_id': model.id, 'feature_name': feature_name, 'files': selected_files, 'findings': _parse_findings(response.content)}


def _tree_paths(tree: str) -> set[str]:
    paths: set[str] = set()
    for line in tree.splitlines():
        value = line.strip().lstrip('+-|` ')
        if '/' in value or '.' in value:
            paths.add(value)
    return paths


def _parse_findings(content: str) -> list[dict[str, str]]:
    raw = content.strip()
    if raw.startswith('```'):
        parts = raw.split('\n', 1)
        raw = parts[1] if len(parts) == 2 else raw
        if raw.endswith('```'):
            raw = raw[:-3].rstrip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail='AI returned an invalid security analysis response') from exc
    findings = []
    allowed = {'informational', 'low', 'medium', 'high', 'critical'}
    for item in payload.get('findings', []):
        if not isinstance(item, dict):
            continue
        severity = str(item.get('severity', 'informational')).lower()
        if severity not in allowed:
            severity = 'informational'
        findings.append({'title': str(item.get('title', 'Security observation')).strip(), 'severity': severity, 'description': str(item.get('description', '')).strip(), 'evidence': str(item.get('evidence', '')).strip(), 'recommendation': str(item.get('recommendation', '')).strip()})
    return findings