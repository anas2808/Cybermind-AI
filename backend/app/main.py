from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes.health import router as health_router
from app.database.connection import engine

from app.api.routes.auth import router as auth_router
from app.api.routes.projects import router as projects_router


app = FastAPI(
    title="CyberMind AI",
    description="AI-Powered Intelligent Security Analyst",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(projects_router)

@app.get("/")
async def root():
    return {
        "service": "CyberMind AI",
        "status": "running",
    }


@app.get("/api/health/database")
async def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as e:
        return {
            "status": "error",
            "database": "not connected",
            "error": str(e),
        }