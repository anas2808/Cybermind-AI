from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.routes.projects import get_db
from app.schemas.code_review import CodeReviewRequest, CodeReviewResponse
from app.security.authentication import get_current_user
from app.services.code_review import review_code


router = APIRouter(prefix="/api/code-review", tags=["Code Review"])


@router.post("/analyze", response_model=CodeReviewResponse)
async def analyze_code(
    request: CodeReviewRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await review_code(
        db=db,
        current_user=current_user,
        provider_id=request.provider_id,
        model_id=request.model_id,
        language=request.language,
        code=request.code,
        review_focus=request.review_focus,
    )
