import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes.projects import get_db
from app.schemas.log_analysis import LogAnalysisRequest, LogAnalysisResponse
from app.security.authentication import get_current_user
from app.services.log_analysis import analyze_security_logs


router = APIRouter(prefix="/api/security", tags=["Security Log Analysis"])


@router.post("/logs/analyze", response_model=LogAnalysisResponse)
async def analyze_logs(
    request: LogAnalysisRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await analyze_security_logs(
        db=db,
        current_user=current_user,
        provider_id=request.provider_id,
        model_id=request.model_id,
        file_name=request.file_name,
        log_content=request.log_content,
    )
