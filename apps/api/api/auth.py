import os
import time
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, Request

_JWKS_CACHE: dict[str, Any] = {}
_JWKS_CACHE_TIMESTAMP: float = 0.0
_JWKS_CACHE_TTL: float = 3600.0  # 1 hour cache


def get_jwks(user_pool_id: str, region: str) -> dict[str, Any]:
    global _JWKS_CACHE, _JWKS_CACHE_TIMESTAMP
    now = time.time()
    if _JWKS_CACHE and (now - _JWKS_CACHE_TIMESTAMP) < _JWKS_CACHE_TTL:
        return _JWKS_CACHE

    jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    try:
        response = httpx.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        _JWKS_CACHE = response.json()
        _JWKS_CACHE_TIMESTAMP = now
        return _JWKS_CACHE
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Unable to fetch Cognito JWKS keys: {exc}"
        ) from exc


def verify_cognito_jwt(
    token: str, user_pool_id: str, region: str, client_id: str | None = None
) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token header") from exc

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing 'kid' header")

    jwks = get_jwks(user_pool_id, region)
    keys = jwks.get("keys", [])
    key_dict = next((k for k in keys if k.get("kid") == kid), None)
    if not key_dict:
        global _JWKS_CACHE_TIMESTAMP
        _JWKS_CACHE_TIMESTAMP = 0.0
        jwks = get_jwks(user_pool_id, region)
        keys = jwks.get("keys", [])
        key_dict = next((k for k in keys if k.get("kid") == kid), None)
        if not key_dict:
            raise HTTPException(status_code=401, detail="Token key ID not found in JWKS")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_dict)
    expected_issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=expected_issuer,
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {exc}") from exc

    token_use = payload.get("token_use")
    if token_use not in {"access", "id"}:
        raise HTTPException(status_code=401, detail="Invalid token_use claim")

    if client_id:
        token_client_id = payload.get("client_id") or payload.get("aud")
        if token_client_id != client_id:
            raise HTTPException(status_code=401, detail="Token client ID / audience mismatch")

    return payload


def extract_local_claims(token: str) -> tuple[str, str] | None:
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        raw_groups = payload.get("cognito:groups", [])
        groups = list(raw_groups) if isinstance(raw_groups, list | tuple) else []
        if "doctor" in groups:
            return str(user_id or "local-doctor"), "doctor"
        if "patient" in groups:
            return str(user_id or "local-patient"), "patient"
    except Exception:
        pass
    return None


def get_current_actor(request: Request) -> tuple[str, str]:
    auth_mode = os.getenv("LUMINA_AUTH_MODE", "").strip().lower()
    auth_header = request.headers.get("authorization", "").strip()

    # Local fallback path: ONLY when LUMINA_AUTH_MODE is explicitly "local"
    if auth_mode == "local":
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token.startswith("local-"):
                role = token[6:]
                if role in {"doctor", "patient"}:
                    return f"local-{role}", role
            claims = extract_local_claims(token)
            if claims:
                return claims

        user_id = request.headers.get("x-lumina-user-id", "").strip()
        role = request.headers.get("x-lumina-role", "").strip()
        if user_id and role in {"doctor", "patient"}:
            return user_id, role

        return "local-doctor", "doctor"

    # Default / Deployed Mode: Require valid Cognito JWT. Ignore x-lumina-* headers.
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header[7:].strip()
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID") or os.getenv(
        "NEXT_PUBLIC_COGNITO_USER_POOL_ID", ""
    )
    region = os.getenv("AWS_REGION") or os.getenv("NEXT_PUBLIC_AWS_REGION", "us-east-1")
    client_id = os.getenv("COGNITO_CLIENT_ID") or os.getenv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "")

    if not user_pool_id:
        raise HTTPException(
            status_code=500, detail="COGNITO_USER_POOL_ID environment variable is not configured"
        )

    payload = verify_cognito_jwt(token, user_pool_id, region, client_id if client_id else None)

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Token payload missing sub claim")

    raw_groups = payload.get("cognito:groups", [])
    groups = list(raw_groups) if isinstance(raw_groups, list | tuple) else []

    if "doctor" in groups:
        role = "doctor"
    elif "patient" in groups:
        role = "patient"
    else:
        raise HTTPException(
            status_code=403, detail="User is missing required role group ('doctor' or 'patient')"
        )

    return user_id, role
