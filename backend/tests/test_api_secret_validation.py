from __future__ import annotations

import pytest

from src import main as api_main


@pytest.mark.asyncio
@pytest.mark.unit
async def test_api_lifespan_logs_and_reraises_secret_validation_value_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_validation() -> None:
        raise ValueError("Unknown STT provider 'bedrock_nova'")

    monkeypatch.setattr(api_main, "validate_secrets", fail_validation)

    with pytest.raises(ValueError, match="bedrock_nova"):
        async with api_main.lifespan(api_main.app):
            pass
