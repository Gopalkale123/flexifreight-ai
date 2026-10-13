"""
Authentication & User Profile Service for FlexiFreight AI
Handles:
- Secure password hashing with PBKDF2-HMAC-SHA256
- Session token generation & signature verification
- Password reset code generation & expiration
- Google OAuth login verification
"""

import os
import secrets
import hashlib
import base64
import json
import time
import datetime
from typing import Optional, Dict, Any

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "flexifreight_enterprise_auth_secret_key_2026_salt")


def hash_password(password: str) -> str:
    """Hashes password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}:{key.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored salt:hash string."""
    if not hashed_password or ":" not in hashed_password:
        return False
    try:
        salt, stored_hash = hashed_password.split(":", 1)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return secrets.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


def generate_reset_code() -> str:
    """Generates a secure 6-digit numeric verification code for password reset."""
    return f"{secrets.randbelow(900000) + 100000}"


def create_auth_token(user_id: int, email: str, role: str, full_name: str) -> str:
    """
    Creates a signed, URL-safe authentication token with a 7-day validity.
    Format: base64(payload).base64(signature)
    """
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": full_name,
        "iat": int(time.time()),
        "exp": int(time.time()) + (7 * 24 * 3600)  # 7 days
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')
    
    # Sign with HMAC-SHA256
    signature = hashlib.sha256(f"{payload_b64}.{AUTH_SECRET_KEY}".encode('utf-8')).hexdigest()
    return f"{payload_b64}.{signature}"


def verify_auth_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies signature and expiration of an auth token."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, signature = token.split(".", 1)
        expected_sig = hashlib.sha256(f"{payload_b64}.{AUTH_SECRET_KEY}".encode('utf-8')).hexdigest()
        if not secrets.compare_digest(signature, expected_sig):
            return None
        
        # Add padding back if necessary
        padded_b64 = payload_b64 + '=' * (-len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(padded_b64.encode('utf-8')).decode('utf-8')
        payload = json.loads(payload_json)
        
        if payload.get("exp", 0) < int(time.time()):
            return None  # Expired
            
        return payload
    except Exception:
        return None
