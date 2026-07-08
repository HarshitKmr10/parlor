"""Rough per-model cost estimation for observability/analytics only.

This is explicitly NOT billing-grade accounting -- it exists so the product
can show a user an *estimate* of what their usage cost, nothing more. It is
never used to gate functionality (no paywall, no quota enforcement here).

Prices are USD per 1,000,000 tokens, as (input_price, output_price), taken
from Anthropic's and OpenAI's publicly published pricing pages as of
~mid-2025. Vendors change pricing without notice; treat these as
ballpark-accurate and re-check against the current pricing pages before
relying on this for anything more than a rough per-request estimate.

Azure OpenAI and the generic OpenAI-compatible provider (OpenRouter,
self-hosted vLLM/Ollama/etc.) reuse this same table keyed by whatever model
name they report. For Azure this is usually a deployment name, not a model
id, so it will typically miss the table and fall back to ``None`` unless the
deployment happens to be named after the underlying model. For
OpenRouter/self-hosted models this table cannot be accurate for arbitrary
third-party or local models -- see ``openai_compatible_provider.py`` for a
TODO on preferring OpenRouter's own reported ``usage.cost`` when present.
"""

from __future__ import annotations

from .base import TokenUsage

# USD per 1,000,000 tokens: (input_price, output_price).
_PRICE_PER_MILLION_TOKENS: dict[str, tuple[float, float]] = {
    # Anthropic -- https://www.anthropic.com/pricing (as of ~2025 pricing)
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-sonnet-4-5-20250929": (3.00, 15.00),
    "claude-haiku-4-5": (0.80, 4.00),
    "claude-haiku-4-5-20251001": (0.80, 4.00),
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-5-sonnet-20241022": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "claude-3-5-haiku-20241022": (0.80, 4.00),
    # OpenAI -- https://openai.com/api/pricing (as of ~2025 pricing)
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "text-embedding-3-small": (0.02, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
}


def estimate_cost_usd(usage: TokenUsage) -> float | None:
    """Estimate the USD cost of ``usage``, or ``None`` for an unknown model.

    Deliberately returns ``None`` rather than guessing for unrecognized
    model/deployment names (e.g. Azure deployment aliases, self-hosted or
    OpenRouter model ids not in the table above) instead of raising or
    approximating from an unrelated model's price.
    """

    prices = _PRICE_PER_MILLION_TOKENS.get(usage.model)
    if prices is None:
        return None
    input_price, output_price = prices
    cost = (usage.prompt_tokens / 1_000_000) * input_price + (
        usage.completion_tokens / 1_000_000
    ) * output_price
    return round(cost, 8)
