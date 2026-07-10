"""Regression tests for two auth-layer hardening fixes:

1. The RequestValidationError handler must not echo the submitted input (a
   failed signup/login would otherwise leak the plaintext password in the 422
   body and any client/proxy logs).
2. Email is normalized (trimmed + lowercased) on the auth-identity request
   models so the stored value is canonical and case-variant duplicate signups
   can't slip past the case-insensitive lookups.
"""

from __future__ import annotations

import json

import pytest
from fastapi.exceptions import RequestValidationError

from src.api.product.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    SignupRequest,
    WorkspaceInviteCreateRequest,
)
from src.main import _safe_validation_details


# ── Password-leak sanitization ──────────────────────────────────────────────
@pytest.mark.unit
def test_safe_validation_details_strips_submitted_input():
    # Shape mirrors Pydantic v2's exc.errors(): it carries the offending value
    # in `input` (and sometimes `ctx`), which for a password field is plaintext.
    exc = RequestValidationError(
        [
            {
                "type": "string_too_short",
                "loc": ("body", "password"),
                "msg": "String should have at least 8 characters",
                "input": "hunter2-secret",
                "ctx": {"min_length": 8},
            }
        ]
    )

    details = _safe_validation_details(exc)

    assert details == [
        {
            "type": "string_too_short",
            "loc": ["body", "password"],
            "msg": "String should have at least 8 characters",
        }
    ]
    # The plaintext value must not survive anywhere in the serialized payload.
    assert "hunter2-secret" not in json.dumps(details)
    assert "input" not in details[0]
    assert "ctx" not in details[0]


@pytest.mark.unit
def test_safe_validation_details_leaks_no_password_from_real_validation():
    # Drive a genuine validation failure so the input actually is the password,
    # then confirm the sanitizer scrubs it end to end.
    from pydantic import ValidationError

    # A distinctive short (< 8 char) value that is not a substring of any
    # Pydantic error type/message, so a hit unambiguously means a real leak.
    secret = "canary1"
    with pytest.raises(ValidationError) as caught:
        SignupRequest(
            email="jane@example.com",
            password=secret,  # < 8 chars -> validation error carrying the value
            name="Jane",
            workspaceName="Jane's workspace",
        )

    exc = RequestValidationError(caught.value.errors())
    assert secret not in json.dumps(_safe_validation_details(exc))


# ── Email normalization ─────────────────────────────────────────────────────
@pytest.mark.unit
@pytest.mark.parametrize("raw", ["Jane@Example.com", "  jane@example.com  ", "JANE@EXAMPLE.COM"])
def test_signup_email_is_normalized(raw):
    body = SignupRequest(
        email=raw, password="longenough1", name="Jane", workspaceName="W"
    )
    assert body.email == "jane@example.com"


@pytest.mark.unit
def test_login_and_forgot_and_invite_emails_are_normalized():
    assert (
        LoginRequest(email="  Jane@Example.com ", password="x").email
        == "jane@example.com"
    )
    assert (
        ForgotPasswordRequest(email="Jane@Example.com").email == "jane@example.com"
    )
    assert (
        WorkspaceInviteCreateRequest(email="Jane@Example.com", role="member").email
        == "jane@example.com"
    )
