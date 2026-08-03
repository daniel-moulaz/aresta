from datetime import UTC, datetime
from secrets import token_hex

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id(prefix: str) -> str:
    return f"{prefix}_{token_hex(6)}"


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("flow"))
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(30), default="webhook")
    target_name: Mapped[str] = mapped_column(String(80))
    input_format: Mapped[str] = mapped_column(String(10), default="json")
    status: Mapped[str] = mapped_column(String(20), default="active")
    field_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    required_fields: Mapped[list] = mapped_column(JSON, default=list)
    signing_secret: Mapped[str | None] = mapped_column(String(180), nullable=True)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    events: Mapped[list["IntegrationEvent"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
    )


class IntegrationEvent(Base):
    __tablename__ = "integration_events"
    __table_args__ = (
        UniqueConstraint("workflow_id", "idempotency_key", name="uq_event_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("evt"))
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(120))
    correlation_id: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(24), default="received", index=True)
    payload_format: Mapped[str] = mapped_column(String(10))
    raw_payload: Mapped[str] = mapped_column(Text)
    normalized_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    transformed_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )

    workflow: Mapped[Workflow] = relationship(back_populates="events")
