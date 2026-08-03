from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    source_type: Literal["webhook", "rest", "queue"] = "webhook"
    target_name: str = Field(min_length=2, max_length=80)
    input_format: Literal["json", "xml"] = "json"
    field_mapping: dict[str, str] = Field(default_factory=dict)
    required_fields: list[str] = Field(default_factory=list)
    signing_secret: str | None = Field(default=None, min_length=12, max_length=180)
    max_retries: int = Field(default=3, ge=0, le=10)


class WorkflowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    source_type: str
    target_name: str
    input_format: str
    status: str
    field_mapping: dict[str, str]
    required_fields: list[str]
    max_retries: int
    created_at: datetime


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow_id: str
    idempotency_key: str
    correlation_id: str
    status: str
    payload_format: str
    normalized_payload: dict | None
    transformed_payload: dict | None
    attempt_count: int
    duration_ms: int | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class MetricsRead(BaseModel):
    workflows: int
    events: int
    succeeded: int
    failed: int
    success_rate: float
