import json
from typing import Any
from xml.etree import ElementTree


class PayloadError(ValueError):
    pass


def normalize_payload(
    raw_payload: bytes | str | dict[str, Any],
    payload_format: str,
) -> dict[str, Any]:
    if isinstance(raw_payload, dict):
        return raw_payload

    text = raw_payload.decode("utf-8") if isinstance(raw_payload, bytes) else raw_payload

    try:
        if payload_format.lower() == "json":
            data = json.loads(text)
        elif payload_format.lower() == "xml":
            root = ElementTree.fromstring(text)
            data = {root.tag: _element_to_value(root)}
        else:
            raise PayloadError(f"Formato não suportado: {payload_format}")
    except (json.JSONDecodeError, ElementTree.ParseError) as exc:
        raise PayloadError("Payload inválido para o formato informado") from exc

    if not isinstance(data, dict):
        raise PayloadError("O payload precisa ter um objeto na raiz")

    return data


def _element_to_value(element: ElementTree.Element) -> Any:
    children = list(element)
    if not children:
        value = (element.text or "").strip()
        if element.attrib:
            return {"_attributes": dict(element.attrib), "_value": value}
        return value

    result: dict[str, Any] = {}
    if element.attrib:
        result["_attributes"] = dict(element.attrib)

    for child in children:
        child_value = _element_to_value(child)
        if child.tag in result:
            current = result[child.tag]
            result[child.tag] = (
                current + [child_value] if isinstance(current, list) else [current, child_value]
            )
        else:
            result[child.tag] = child_value

    return result


def read_path(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for segment in path.split("."):
        if not isinstance(current, dict) or segment not in current:
            return None
        current = current[segment]
    return current


def write_path(payload: dict[str, Any], path: str, value: Any) -> None:
    segments = path.split(".")
    current = payload
    for segment in segments[:-1]:
        child = current.get(segment)
        if not isinstance(child, dict):
            child = {}
            current[segment] = child
        current = child
    current[segments[-1]] = value


def transform_payload(payload: dict[str, Any], field_mapping: dict[str, str]) -> dict[str, Any]:
    if not field_mapping:
        return payload.copy()

    transformed: dict[str, Any] = {}
    for source_path, target_path in field_mapping.items():
        value = read_path(payload, source_path)
        if value is not None:
            write_path(transformed, target_path, value)
    return transformed


def find_missing_fields(payload: dict[str, Any], required_fields: list[str]) -> list[str]:
    return [path for path in required_fields if read_path(payload, path) in (None, "")]
