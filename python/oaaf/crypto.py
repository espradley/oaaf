"""Cryptographic primitives: base64url, Ed25519 JWS verification, JWK thumbprint.

Uses `cryptography` for Ed25519 and `rfc8785` for JSON canonicalization; no
cryptography is implemented here. Everything is standards-grounded: JWS compact
(RFC 7515), JWK thumbprint (RFC 7638) as a URI (RFC 9278), JCS (RFC 8785).
"""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any, Optional

import rfc8785
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

PERMITTED_ALGS = {"EdDSA"}
PERMITTED_CURVES = {"Ed25519", "Ed448"}


def b64url_decode(value: str) -> Optional[bytes]:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, TypeError):
        return None


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def jcs(value: Any) -> bytes:
    """RFC 8785 canonical JSON — the same bytes both implementations must produce."""
    return rfc8785.dumps(value)


def sha256_b64url(data: bytes) -> str:
    return b64url_encode(hashlib.sha256(data).digest())


def contains_private_key_material(jwk: dict) -> bool:
    return any(m in jwk for m in ("d", "p", "q", "dp", "dq", "qi"))


def jwk_thumbprint_uri(jwk: dict) -> str:
    """RFC 7638 thumbprint of an OKP key as an RFC 9278 URI."""
    canonical = {"crv": jwk["crv"], "kty": jwk["kty"], "x": jwk["x"]}
    digest = sha256_b64url(jcs(canonical))
    return f"urn:ietf:params:oauth:jwk-thumbprint:sha-256:{digest}"


def verify_compact_jws(token: str, jwk: dict) -> Optional[dict]:
    """Verify a compact JWS under an OKP/Ed25519 JWK; return the payload or None.

    Enforces the algorithm allowlist and alg/key-type consistency (rejecting
    `alg: none` and algorithm confusion), as the AAT draft requires.
    """
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header_raw = b64url_decode(parts[0])
    if header_raw is None:
        return None
    try:
        header = json.loads(header_raw)
    except ValueError:
        return None
    if header.get("alg") not in PERMITTED_ALGS:
        return None
    if jwk.get("kty") != "OKP" or jwk.get("crv") not in PERMITTED_CURVES:
        return None
    x = b64url_decode(jwk["x"])
    if x is None:
        return None
    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    signature = b64url_decode(parts[2])
    if signature is None:
        return None
    try:
        Ed25519PublicKey.from_public_bytes(x).verify(signature, signing_input)
    except (InvalidSignature, ValueError):
        return None
    payload_raw = b64url_decode(parts[1])
    if payload_raw is None:
        return None
    try:
        return json.loads(payload_raw)
    except ValueError:
        return None


def parent_hash(token: str) -> str:
    """base64url-nopad SHA-256 of a token's JWS signing input (header.payload)."""
    signing_input = token[: token.rfind(".")]
    return sha256_b64url(signing_input.encode("ascii"))


def alg_permitted(token: str) -> bool:
    parts = token.split(".")
    if len(parts) != 3:
        return False
    header_raw = b64url_decode(parts[0])
    if header_raw is None:
        return False
    try:
        return json.loads(header_raw).get("alg") in PERMITTED_ALGS
    except ValueError:
        return False
