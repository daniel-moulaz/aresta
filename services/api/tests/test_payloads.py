import unittest

from app.services.payloads import (
    PayloadError,
    find_missing_fields,
    normalize_payload,
    transform_payload,
)


class PayloadTests(unittest.TestCase):
    def test_normalizes_json_bytes(self) -> None:
        result = normalize_payload(b'{"order":{"id":"ord-42"}}', "json")
        self.assertEqual(result["order"]["id"], "ord-42")

    def test_normalizes_xml_with_nested_fields(self) -> None:
        xml = "<order><id>ord-42</id><customer><email>daniel@example.com</email></customer></order>"
        result = normalize_payload(xml, "xml")
        self.assertEqual(result["order"]["customer"]["email"], "daniel@example.com")

    def test_rejects_invalid_json(self) -> None:
        with self.assertRaises(PayloadError):
            normalize_payload("{invalid", "json")

    def test_maps_nested_fields(self) -> None:
        payload = {"order": {"id": "ord-42"}, "customer": {"email": "daniel@example.com"}}
        result = transform_payload(
            payload,
            {"order.id": "external_id", "customer.email": "contact.email"},
        )
        self.assertEqual(
            result,
            {"external_id": "ord-42", "contact": {"email": "daniel@example.com"}},
        )

    def test_lists_missing_required_fields(self) -> None:
        missing = find_missing_fields({"order": {"id": ""}}, ["order.id", "customer.email"])
        self.assertEqual(missing, ["order.id", "customer.email"])


if __name__ == "__main__":
    unittest.main()
