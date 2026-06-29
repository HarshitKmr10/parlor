"""Unit tests for PII redaction (pure)."""

from src.redaction import redact_segments, redact_text

ON = {
    "redaction_enabled": True,
    "redact_emails": True,
    "redact_phones": True,
    "redact_cards": True,
}


def test_disabled_is_passthrough():
    text = "Email me at a@b.com"
    assert redact_text(text, {"redaction_enabled": False}) == text


def test_redacts_email():
    out = redact_text("Reach me at alice@example.com please", ON)
    assert "alice@example.com" not in out
    assert "[redacted-email]" in out


def test_redacts_phone():
    out = redact_text("Call +1 (415) 555-1234 today", ON)
    assert "555-1234" not in out
    assert "[redacted-phone]" in out


def test_redacts_card():
    out = redact_text("Card 4111 1111 1111 1111 on file", ON)
    assert "4111 1111 1111 1111" not in out
    assert "[redacted-card]" in out


def test_selective_toggle_keeps_emails():
    policy = {**ON, "redact_emails": False}
    out = redact_text("a@b.com called 415-555-1234", policy)
    assert "a@b.com" in out
    assert "[redacted-phone]" in out


def test_redact_segments_copies_and_redacts():
    segs = [{"text": "ping me at x@y.com", "speakerName": "Bob"}]
    out = redact_segments(segs, ON)
    assert "[redacted-email]" in out[0]["text"]
    assert out[0]["speakerName"] == "Bob"
    assert segs[0]["text"] == "ping me at x@y.com"  # original untouched
