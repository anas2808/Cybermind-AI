from fastapi import FastAPI
from sqlalchemy import text

from app.api.routes.health import router as health_router
from app.database.connection import engine
from app.api.routes.auth import router as auth_router
from app.api.routes.projects import router as projects_router
from app.api.routes.ai_providers import router as ai_providers_router
from app.api.routes.project_analysis import router as project_analysis_router
from app.api.routes.feature_analysis import router as feature_analysis_router

app = FastAPI(
    title="CyberMind AI",
    description="AI-Powered Intelligent Security Analyst",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(ai_providers_router)
app.include_router(project_analysis_router)
app.include_router(feature_analysis_router)


@app.get("/")
async def root():
    return {"service": "CyberMind AI", "status": "running"}


@app.get("/api/health/database")
async def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {
            "status": "error",
            "database": "not connected",
            "error": str(e),
        }
