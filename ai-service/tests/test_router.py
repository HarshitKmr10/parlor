"""Unit tests for ProviderRouter: blank-segment embed handling (#22) and the
total time budget across the fallback chain (#47).

Uses small fake :class:`LLMProvider` doubles (no network) injected via
``router._live`` so the fallback/timeout behavior can be exercised
deterministically, mirroring how ``tests/test_chat.py`` builds a real
``ProviderRouter`` in mock mode for its own scenarios.
"""

from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.providers.base import LLMProvider, ProviderError
from app.providers.router import ProviderRouter


def _mock_settings(provider_order: list[str] | None = None) -> Settings:
    return Settings(
        anthropic_api_key=None,
        openai_api_key=None,
        azure_openai_endpoint=None,
        azure_openai_api_key=None,
        azure_openai_api_version="2024-02-15-preview",
        azure_openai_deployment="gpt-5.4-mini",
        azure_openai_embedding_deployment=None,
        provider_order=provider_order or [],
        database_url=None,
        mode="mock",
    )


def _live_settings() -> Settings:
    """Settings with ``mode="live"`` so ``_chain()`` will actually consult
    ``router._live`` (fake providers injected directly by tests below)
    instead of collapsing straight to the mock-only chain."""
    settings = _mock_settings()
    return Settings(**{**settings.__dict__, "mode": "live"})


class _FakeProvider(LLMProvider):
    """A minimal live-provider double: records the batch it was called with
    and either returns a fixed embedding, raises, or hangs for ``delay``
    seconds before returning."""

    def __init__(self, name: str, *, delay: float = 0.0, fail: bool = False) -> None:
        self.name = name
        self._delay = delay
        self._fail = fail
        self.embed_calls: list[list[str]] = []

    async def complete_json(self, **_kwargs) -> str:
        raise ProviderError(self.name, "not used in these tests")

    async def complete_text(self, **_kwargs) -> str:
        raise ProviderError(self.name, "not used in these tests")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.embed_calls.append(texts)
        if self._delay:
            await asyncio.sleep(self._delay)
        if self._fail:
            raise ProviderError(self.name, "boom")
        return [[float(len(t))] for t in texts]


@pytest.fixture
def router() -> ProviderRouter:
    return ProviderRouter(_live_settings())


@pytest.fixture
def mock_mode_router() -> ProviderRouter:
    """A router with no live providers configured (``mode="mock"``), for the
    scenarios that specifically exercise the mock-only path."""
    return ProviderRouter(_mock_settings())


class TestBlankSegmentEmbedding:
    """Issue #22: a blank/whitespace-only segment must not downgrade the
    entire batch to mock vectors."""

    @pytest.mark.asyncio
    async def test_blank_segment_does_not_reach_mock_when_a_live_provider_is_configured(
        self, router: ProviderRouter
    ):
        fake = _FakeProvider("fake-live")
        router._live = [fake]  # noqa: SLF001 - test seam, mirrors _chain() usage

        result = await router.embed(["hello world", "   ", ""])

        # The live provider handled the whole batch -- no fall-through to mock.
        assert len(fake.embed_calls) == 1
        sent = fake.embed_calls[0]
        assert len(sent) == 3
        # Blank entries were substituted with a placeholder, never sent as "".
        assert sent[1].strip()
        assert sent[2].strip()
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_all_blank_batch_still_only_uses_placeholders(
        self, router: ProviderRouter
    ):
        fake = _FakeProvider("fake-live")
        router._live = [fake]  # noqa: SLF001

        await router.embed(["", "  ", "\t\n"])

        sent = fake.embed_calls[0]
        assert all(t.strip() for t in sent)

    @pytest.mark.asyncio
    async def test_non_blank_segments_are_untouched(self, router: ProviderRouter):
        fake = _FakeProvider("fake-live")
        router._live = [fake]  # noqa: SLF001

        await router.embed(["first segment", "second segment"])

        assert fake.embed_calls[0] == ["first segment", "second segment"]

    @pytest.mark.asyncio
    async def test_mock_mode_still_returns_one_vector_per_input_including_blanks(
        self, mock_mode_router: ProviderRouter
    ):
        """Regression: mock mode (no live providers) keeps working end-to-end
        with a mix of real and blank segment text."""
        result = await mock_mode_router.embed(["real text", ""])

        assert len(result) == 2


class TestRequestTimeBudget:
    """Issue #47: the fallback chain must not let one hanging live provider
    consume the caller's entire HTTP timeout budget."""

    @pytest.mark.asyncio
    async def test_fast_failure_on_first_provider_still_leaves_budget_for_the_next(
        self, router: ProviderRouter, monkeypatch: pytest.MonkeyPatch
    ):
        """A provider that fails quickly (e.g. auth/4xx, not a hang) must
        still leave the rest of the budget for the next provider in the
        chain -- the budget only matters for slow/hanging failures."""
        monkeypatch.setattr("app.providers.router.REQUEST_TIME_BUDGET", 5.0)
        broken = _FakeProvider("broken", fail=True)
        fast = _FakeProvider("fast")
        router._live = [broken, fast]  # noqa: SLF001

        result = await router.embed(["hi"])

        assert result == [[2.0]]
        assert fast.embed_calls == [["hi"]]

    @pytest.mark.asyncio
    async def test_hanging_provider_is_capped_at_the_remaining_budget_not_its_own_timeout(
        self, router: ProviderRouter, monkeypatch: pytest.MonkeyPatch
    ):
        """A provider that would hang far longer than the request budget must
        be aborted once the budget is spent, rather than run to completion."""
        monkeypatch.setattr("app.providers.router.REQUEST_TIME_BUDGET", 0.2)
        slow = _FakeProvider("slow", delay=5.0)
        router._live = [slow]  # noqa: SLF001

        start = asyncio.get_event_loop().time()
        # No more live providers to try after the hang, but the mock safety
        # net (no I/O) still answers -- so this returns, it does not raise.
        result = await router.embed(["hi"])
        elapsed = asyncio.get_event_loop().time() - start

        assert len(result) == 1
        assert elapsed < 1.0  # nowhere near the provider's 5s delay

    @pytest.mark.asyncio
    async def test_budget_exhausted_by_one_provider_skips_remaining_live_providers(
        self, router: ProviderRouter, monkeypatch: pytest.MonkeyPatch
    ):
        """Once the total budget is spent, the router must not spend any more
        time trying further LIVE providers -- even fast ones -- and should
        fall straight through to the mock safety net."""
        monkeypatch.setattr("app.providers.router.REQUEST_TIME_BUDGET", 0.2)
        slow = _FakeProvider("slow", delay=5.0)
        fast = _FakeProvider("fast")
        router._live = [slow, fast]  # noqa: SLF001

        await router.embed(["hi"])

        assert fast.embed_calls == []  # skipped, never invoked

    @pytest.mark.asyncio
    async def test_total_chain_latency_stays_within_the_configured_budget(
        self, router: ProviderRouter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr("app.providers.router.REQUEST_TIME_BUDGET", 0.3)
        # Three providers that would each hang far longer than the total
        # budget if tried at full length.
        providers = [_FakeProvider(f"slow-{i}", delay=10.0) for i in range(3)]
        router._live = providers

        start = asyncio.get_event_loop().time()
        result = await router.embed(["hi"])
        elapsed = asyncio.get_event_loop().time() - start

        # The mock safety net still answers, and well under what three
        # sequential 10s hangs would take; generous margin keeps this from
        # being flaky under CI load.
        assert len(result) == 1
        assert elapsed < 3.0

    @pytest.mark.asyncio
    async def test_mock_safety_net_still_runs_even_after_budget_is_exhausted(
        self, router: ProviderRouter, monkeypatch: pytest.MonkeyPatch
    ):
        """The mock fallback has no I/O, so it stays a safety net regardless
        of the live-provider time budget -- callers still get a structured
        response instead of a hard failure."""
        monkeypatch.setattr("app.providers.router.REQUEST_TIME_BUDGET", 0.05)
        slow = _FakeProvider("slow", delay=5.0)
        router._live = [slow]  # noqa: SLF001

        result = await router.embed(["hi"])

        assert len(result) == 1
