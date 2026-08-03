from dataclasses import dataclass
from typing import Any

from app.services.payloads import find_missing_fields, transform_payload


@dataclass(frozen=True)
class ProcessingResult:
    status: str
    transformed_payload: dict[str, Any] | None
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool = False


class IntegrationEngine:
    """Small deterministic engine used before a real destination adapter is called."""

    def process(
        self,
        payload: dict[str, Any],
        *,
        field_mapping: dict[str, str],
        required_fields: list[str],
        attempt: int,
        max_retries: int,
    ) -> ProcessingResult:
        missing_fields = find_missing_fields(payload, required_fields)
        if missing_fields:
            return ProcessingResult(
                status="failed",
                transformed_payload=None,
                error_code="VALIDATION_ERROR",
                error_message=f"Campos obrigatórios ausentes: {', '.join(missing_fields)}",
                retryable=False,
            )

        transformed = transform_payload(payload, field_mapping)

        # This flag makes failure and retry scenarios reproducible in the demo.
        if payload.get("simulate_failure") is True:
            has_retry = attempt <= max_retries
            return ProcessingResult(
                status="failed" if has_retry else "dead_letter",
                transformed_payload=transformed,
                error_code="TARGET_TIMEOUT",
                error_message="A API de destino não respondeu dentro do limite",
                retryable=has_retry,
            )

        return ProcessingResult(status="succeeded", transformed_payload=transformed)
