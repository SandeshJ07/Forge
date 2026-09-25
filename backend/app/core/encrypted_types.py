"""
Column types that encrypt on write and decrypt on read (see app/core/crypto.py),
so models and routes keep working with plain Python values. Stored as text;
such columns can't be filtered, sorted or aggregated in SQL — only use them
for values the app reads back per row.
"""

import json
from typing import Any

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.crypto import decrypt, encrypt


class _Encrypted(TypeDecorator):
    impl = Text
    cache_ok = True

    def _to_text(self, value: Any) -> str:
        return str(value)

    def _from_text(self, text: str) -> Any:
        return text

    def process_bind_param(self, value: Any, dialect) -> str | None:
        return None if value is None else encrypt(self._to_text(value))

    def process_result_value(self, value: str | None, dialect) -> Any:
        return None if value is None else self._from_text(decrypt(value))


class EncryptedString(_Encrypted):
    pass


class EncryptedInt(_Encrypted):
    def _from_text(self, text: str) -> int:
        return int(text)


class EncryptedFloat(_Encrypted):
    def _to_text(self, value: Any) -> str:
        return repr(float(value))

    def _from_text(self, text: str) -> float:
        return float(text)


class EncryptedJSON(_Encrypted):
    def _to_text(self, value: Any) -> str:
        return json.dumps(value, separators=(",", ":"))

    def _from_text(self, text: str) -> Any:
        return json.loads(text)
