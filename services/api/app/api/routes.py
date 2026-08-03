from secrets import token_hex
from time import perf_counter

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IntegrationEvent, Workflow
from app.schemas import EventRead, MetricsRead, WorkflowCreate, WorkflowRead
from app.services.engine import IntegrationEngine
from app.services.payloads import PayloadError, normalize_payload
from app.services.signatures import verify_signature

router = APIRouter(prefix="/api/v1")
integration_engine = IntegrationEngine()


@router.get("/workflows", response_model=list[WorkflowRead])
def list_workflows(database: Session = Depends(get_db)) -> list[Workflow]:
    return list(database.scalars(select(Workflow).order_by(Workflow.created_at.desc())))


@router.post("/workflows", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreate, database: Session = Depends(get_db)) -> Workflow:
    workflow = Workflow(**payload.model_dump())
    database.add(workflow)
    try:
        database.commit()
    except IntegrityError as exc:
        database.rollback()
        raise HTTPException(status_code=409, detail="Já existe um fluxo com esse nome") from exc
    database.refresh(workflow)
    return workflow


@router.get("/events", response_model=list[EventRead])
def list_events(
    event_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    database: Session = Depends(get_db),
) -> list[IntegrationEvent]:
    query = select(IntegrationEvent).order_by(IntegrationEvent.created_at.desc()).limit(limit)
    if event_status:
        query = query.where(IntegrationEvent.status == event_status)
    return list(database.scalars(query))


@router.post(
    "/workflows/{workflow_id}/events",
    response_model=EventRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_event(
    workflow_id: str,
    request: Request,
    response: Response,
    idempotency_key: str = Header(alias="X-Idempotency-Key", min_length=4, max_length=120),
    aresta_signature: str | None = Header(default=None, alias="X-Aresta-Signature"),
    correlation_id: str | None = Header(default=None, alias="X-Correlation-ID"),
    database: Session = Depends(get_db),
) -> IntegrationEvent:
    workflow = database.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Fluxo não encontrado")

    previous_event = database.scalar(
        select(IntegrationEvent).where(
            IntegrationEvent.workflow_id == workflow_id,
            IntegrationEvent.idempotency_key == idempotency_key,
        )
    )
    if previous_event:
        response.status_code = status.HTTP_200_OK
        response.headers["X-Aresta-Deduplicated"] = "true"
        return previous_event

    raw_payload = await request.body()
    if workflow.signing_secret and not verify_signature(
        workflow.signing_secret,
        raw_payload,
        aresta_signature,
    ):
        raise HTTPException(status_code=401, detail="Assinatura do webhook inválida")

    payload_format = _detect_format(request.headers.get("content-type"), workflow.input_format)
    started_at = perf_counter()
    event = IntegrationEvent(
        workflow_id=workflow.id,
        idempotency_key=idempotency_key,
        correlation_id=correlation_id or f"cor_{token_hex(6)}",
        status="processing",
        payload_format=payload_format,
        raw_payload=raw_payload.decode("utf-8", errors="replace"),
        attempt_count=1,
    )

    try:
        normalized = normalize_payload(raw_payload, payload_format)
        result = integration_engine.process(
            normalized,
            field_mapping=workflow.field_mapping,
            required_fields=workflow.required_fields,
            attempt=event.attempt_count,
            max_retries=workflow.max_retries,
        )
        event.normalized_payload = normalized
        event.transformed_payload = result.transformed_payload
        event.status = result.status
        event.error_code = result.error_code
        event.error_message = result.error_message
    except PayloadError as exc:
        event.status = "failed"
        event.error_code = "INVALID_PAYLOAD"
        event.error_message = str(exc)

    event.duration_ms = round((perf_counter() - started_at) * 1000)
    database.add(event)
    database.commit()
    database.refresh(event)
    return event


@router.post("/events/{event_id}/retry", response_model=EventRead)
def retry_event(event_id: str, database: Session = Depends(get_db)) -> IntegrationEvent:
    event = database.get(IntegrationEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    if event.status == "succeeded":
        raise HTTPException(status_code=409, detail="O evento já foi concluído")

    workflow = event.workflow
    event.attempt_count += 1
    started_at = perf_counter()
    result = integration_engine.process(
        event.normalized_payload or {},
        field_mapping=workflow.field_mapping,
        required_fields=workflow.required_fields,
        attempt=event.attempt_count,
        max_retries=workflow.max_retries,
    )
    event.transformed_payload = result.transformed_payload
    event.status = result.status
    event.error_code = result.error_code
    event.error_message = result.error_message
    event.duration_ms = round((perf_counter() - started_at) * 1000)
    database.commit()
    database.refresh(event)
    return event


@router.get("/metrics", response_model=MetricsRead)
def read_metrics(database: Session = Depends(get_db)) -> MetricsRead:
    workflows = database.scalar(select(func.count()).select_from(Workflow)) or 0
    events = database.scalar(select(func.count()).select_from(IntegrationEvent)) or 0
    succeeded_query = (
        select(func.count())
        .select_from(IntegrationEvent)
        .where(IntegrationEvent.status == "succeeded")
    )
    succeeded = database.scalar(succeeded_query) or 0
    failed = database.scalar(
        select(func.count()).select_from(IntegrationEvent).where(
            IntegrationEvent.status.in_(["failed", "dead_letter"])
        )
    ) or 0
    success_rate = round((succeeded / events) * 100, 1) if events else 0.0
    return MetricsRead(
        workflows=workflows,
        events=events,
        succeeded=succeeded,
        failed=failed,
        success_rate=success_rate,
    )


def _detect_format(content_type: str | None, fallback: str) -> str:
    normalized = (content_type or "").lower()
    if "xml" in normalized:
        return "xml"
    if "json" in normalized:
        return "json"
    return fallback
