from uuid import UUID
from pydantic import BaseModel, Field


class LogAnalysisRequest(BaseModel):
    provider_id: UUID
    model_id: UUID
    file_name: str = Field(default="pasted-log.txt", min_length=1, max_length=255)
    log_content: str = Field(min_length=1, max_length=200000)
    log_type: str = Field(default="auto_detect", pattern="^(auto_detect|windows_security|windows_system_application|web_server|firewall_network|endpoint_edr|application_server|database|cloud_audit)$")
    severity_levels: list[str] = Field(default=["critical", "high", "medium", "low", "info"], min_length=1, max_length=5)


class LogFinding(BaseModel):
    title: str
    severity: str
    description: str
    evidence: str
    recommendation: str


class LogAnalysisResponse(BaseModel):
    provider_id: UUID
    model_id: UUID
    file_name: str
    summary: str
    findings: list[LogFinding]
    lines_analyzed: int
    limitations: list[str]
