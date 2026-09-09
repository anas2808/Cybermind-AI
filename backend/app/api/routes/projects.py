import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.user import User
from app.models.projects import Project
from app.models.projects import Project
from app.schemas.project import ProjectCreate, ProjectResponse
from app.security.authentication import get_current_user


router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_user_id = current_user.id

    user = db.execute(
        select(User).where(
            User.auth_user_id == auth_user_id
        )
    ).scalar_one_or_none()

    if not user:
        user = User(
            auth_user_id=auth_user_id,
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

    project = Project(
        owner_id=user.id,
        name=project_data.name,
        description=project_data.description,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/", response_model=list[ProjectResponse])
async def get_projects(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.execute(
        select(User).where(
            User.auth_user_id == current_user.id
        )
    ).scalar_one_or_none()

    if not user:
        return []

    projects = db.execute(
        select(Project).where(
            Project.owner_id == user.id
        )
    ).scalars().all()

    return projects