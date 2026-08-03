import hashlib
import hmac


def create_signature(secret: str, payload: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(secret: str, payload: bytes, provided_signature: str | None) -> bool:
    if not provided_signature:
        return False
    expected = create_signature(secret, payload)
    return hmac.compare_digest(expected, provided_signature)
