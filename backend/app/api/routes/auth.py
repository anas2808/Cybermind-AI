from fastapi import APIRouter, HTTPException

from app.core.supabase import supabase


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post("/register")
async def register(
    email: str,
    password: str,
):
    try:
        response = supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
            }
        )

        return {
            "message": "Registration successful",
            "user_id": response.user.id if response.user else None,
            "session": response.session,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.post("/login")
async def login(
    email: str,
    password: str,
):
    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": email,
                "password": password,
            }
        )

        return {
            "message": "Login successful",
            "access_token": response.session.access_token
            if response.session
            else None,
            "refresh_token": response.session.refresh_token
            if response.session
            else None,
            "user": response.user,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )