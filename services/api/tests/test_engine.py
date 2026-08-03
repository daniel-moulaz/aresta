import unittest

from app.services.engine import IntegrationEngine


class IntegrationEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = IntegrationEngine()
        self.mapping = {"order.id": "external_id", "customer.email": "contact.email"}
        self.required = ["order.id", "customer.email"]

    def test_processes_valid_payload(self) -> None:
        result = self.engine.process(
            {"order": {"id": "ord-42"}, "customer": {"email": "daniel@example.com"}},
            field_mapping=self.mapping,
            required_fields=self.required,
            attempt=1,
            max_retries=3,
        )
        self.assertEqual(result.status, "succeeded")
        self.assertEqual(result.transformed_payload["external_id"], "ord-42")

    def test_validation_failure_is_not_retryable(self) -> None:
        result = self.engine.process(
            {"order": {"id": "ord-42"}},
            field_mapping=self.mapping,
            required_fields=self.required,
            attempt=1,
            max_retries=3,
        )
        self.assertEqual(result.error_code, "VALIDATION_ERROR")
        self.assertFalse(result.retryable)

    def test_timeout_can_be_retried(self) -> None:
        result = self.engine.process(
            {
                "order": {"id": "ord-42"},
                "customer": {"email": "daniel@example.com"},
                "simulate_failure": True,
            },
            field_mapping=self.mapping,
            required_fields=self.required,
            attempt=2,
            max_retries=3,
        )
        self.assertEqual(result.status, "failed")
        self.assertTrue(result.retryable)

    def test_moves_exhausted_event_to_dead_letter(self) -> None:
        result = self.engine.process(
            {
                "order": {"id": "ord-42"},
                "customer": {"email": "daniel@example.com"},
                "simulate_failure": True,
            },
            field_mapping=self.mapping,
            required_fields=self.required,
            attempt=4,
            max_retries=3,
        )
        self.assertEqual(result.status, "dead_letter")
        self.assertFalse(result.retryable)


if __name__ == "__main__":
    unittest.main()
