import unittest

from app.services.signatures import create_signature, verify_signature


class SignatureTests(unittest.TestCase):
    def test_valid_signature(self) -> None:
        payload = b'{"event":"order.created"}'
        signature = create_signature("a-local-demo-secret", payload)
        self.assertTrue(verify_signature("a-local-demo-secret", payload, signature))

    def test_rejects_modified_payload(self) -> None:
        signature = create_signature("a-local-demo-secret", b"original")
        self.assertFalse(verify_signature("a-local-demo-secret", b"modified", signature))


if __name__ == "__main__":
    unittest.main()
