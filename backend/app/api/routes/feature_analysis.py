import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.projects import get_db
from app.models.projects import Project
from app.models.user import User
from app.schemas.feature_analysis import FeatureSecurityAnalysisRequest, FeatureSecurityAnalysisResponse
from app.security.authentication import get_current_user
from app.services.feature_analysis import analyze_feature_security


router = APIRouter(prefix="/api/projects", tags=["Feature Security Analysis"])


@router.post(
    "/{project_id}/analysis/feature",
    response_model=FeatureSecurityAnalysisResponse,
)
async def analyze_feature(
    project_id: uuid.UUID,
    request: FeatureSecurityAnalysisRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.execute(
        select(Project)
        .join(User, Project.owner_id == User.id)
        .where(Project.id == project_id, User.auth_user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return await analyze_feature_security(
        db=db,
        project=project,
        current_user=current_user,
        provider_id=request.provider_id,
        model_id=request.model_id,
        feature_name=request.feature_name,
        files=request.files,
    )
