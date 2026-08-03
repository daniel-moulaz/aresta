import os
import unittest
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_aresta.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.drop_all(bind=engine)
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client_context.__exit__(None, None, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        Path("test_aresta.db").unlink(missing_ok=True)

    def workflow_id(self) -> str:
        response = self.client.get("/api/v1/workflows")
        self.assertEqual(response.status_code, 200)
        return response.json()[0]["id"]

    def test_health_check(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_ingests_and_deduplicates_event(self) -> None:
        workflow_id = self.workflow_id()
        payload = {
            "order": {"id": "ord-api-1"},
            "customer": {"email": "api@example.com"},
            "total": 79.9,
        }
        headers = {"X-Idempotency-Key": "ord-api-1", "X-Correlation-ID": "test-api-1"}

        first = self.client.post(
            f"/api/v1/workflows/{workflow_id}/events",
            json=payload,
            headers=headers,
        )
        duplicate = self.client.post(
            f"/api/v1/workflows/{workflow_id}/events",
            json=payload,
            headers=headers,
        )

        self.assertEqual(first.status_code, 202)
        self.assertEqual(first.json()["status"], "succeeded")
        self.assertEqual(first.json()["transformed_payload"]["external_id"], "ord-api-1")
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.headers["X-Aresta-Deduplicated"], "true")
        self.assertEqual(first.json()["id"], duplicate.json()["id"])

    def test_keeps_validation_error_out_of_retry(self) -> None:
        workflow_id = self.workflow_id()
        response = self.client.post(
            f"/api/v1/workflows/{workflow_id}/events",
            json={"order": {"id": "ord-invalid"}},
            headers={"X-Idempotency-Key": "ord-invalid"},
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "failed")
        self.assertEqual(response.json()["error_code"], "VALIDATION_ERROR")

    def test_moves_timeout_to_dead_letter_after_retries(self) -> None:
        workflow_id = self.workflow_id()
        response = self.client.post(
            f"/api/v1/workflows/{workflow_id}/events",
            json={
                "order": {"id": "ord-timeout"},
                "customer": {"email": "timeout@example.com"},
                "simulate_failure": True,
            },
            headers={"X-Idempotency-Key": "ord-timeout"},
        )
        event_id = response.json()["id"]

        for expected_attempt in (2, 3, 4):
            response = self.client.post(f"/api/v1/events/{event_id}/retry")
            self.assertEqual(response.json()["attempt_count"], expected_attempt)

        self.assertEqual(response.json()["status"], "dead_letter")


if __name__ == "__main__":
    unittest.main()
