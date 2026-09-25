"""
Application-level encryption for sensitive data at rest.

Everything here derives from one secret, DATA_ENCRYPTION_KEY (a Fernet key,
kept in .env and never in the database):

- encrypt / decrypt: Fernet (AES-128-CBC + HMAC-SHA256, random IV), for
  values the app needs back — API keys, email addresses, body data, notes,
  progress photos. Two encryptions of the same value differ.
- keyed_hash: HMAC-SHA256 under a key derived from the same secret, for
  values that are only ever compared — email codes, and the email "blind
  index" that lets sign-in find a user without storing the address in
  plain text. Keyed (not a bare SHA-256) so a 6-digit code or a known email
  can't be brute-forced from a leaked database alone.

Losing DATA_ENCRYPTION_KEY makes encrypted data unreadable: back it up.
"""

import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import get_settings

__all__ = ["InvalidToken", "decrypt", "decrypt_bytes", "encrypt", "encrypt_bytes", "keyed_hash"]


@lru_cache
def _fernet() -> Fernet:
    return Fernet(get_settings().data_encryption_key.encode())


@lru_cache
def _hash_key(purpose: str) -> bytes:
    # A separate key per purpose, so an email hash can never collide with a code hash.
    master = get_settings().data_encryption_key.encode()
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=f"forge:{purpose}".encode()).derive(master)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def encrypt_bytes(data: bytes) -> bytes:
    return _fernet().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return _fernet().decrypt(token)


def keyed_hash(value: str, purpose: str) -> str:
    """Deterministic HMAC-SHA256 hex digest of `value`; `purpose` separates uses (e.g. "email", "email-code")."""
    return hmac.new(_hash_key(purpose), value.encode(), hashlib.sha256).hexdigest()


def email_index(email: str) -> str:
    """Blind index for looking a user up by email (case-insensitive)."""
    return keyed_hash(email.strip().lower(), "email")
