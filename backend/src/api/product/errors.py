"""Explicit error envelope for the /api/v1 product layer.

Per API-CONTRACT.md, errors are returned as
``{ "error": { "code": str, "message": str, "details"?: any } }`` with an
appropriate 4xx/5xx status. :class:`ApiError` carries that shape; the exception
handler registered in ``main.py`` renders it.
"""

from __future__ import annotations

from typing import Any, Optional


class ApiError(Exception):
    """Raised by product routes to emit a contract-compliant error envelope."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details

    def envelope(self) -> dict[str, Any]:
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            error["details"] = self.details
        return {"error": error}
