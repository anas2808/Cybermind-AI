import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.projects import get_db
from app.models.projects import Project
from app.models.user import User
from app.schemas.project_analysis import ProjectStructureAnalysisRequest, ProjectStructureAnalysisResponse
from app.security.authentication import get_current_user
from app.services.project_analysis import analyze_project_structure


router = APIRouter(prefix="/api/projects", tags=["Project Analysis"])


@router.post(
    "/{project_id}/analysis/structure",
    response_model=ProjectStructureAnalysisResponse,
)
async def analyze_structure(
    project_id: uuid.UUID,
    request: ProjectStructureAnalysisRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.execute(
        select(Project)
        .join(User, Project.owner_id == User.id)
        .where(Project.id == project_id, User.auth_user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    return await analyze_project_structure(
        db=db,
        project=project,
        current_user=current_user,
        provider_id=request.provider_id,
        model_id=request.model_id,
        options=request.options,
    )
