"""
Rate limiter for external API calls.
Uses a token-bucket algorithm to respect per-minute and per-month limits.
"""

import asyncio
import time
from collections import defaultdict


class RateLimiter:
    """Token-bucket rate limiter for API calls."""

    def __init__(self, requests_per_minute: int = 60, requests_per_month: int = 50000):
        self.rpm = requests_per_minute
        self.monthly_limit = requests_per_month
        self._minute_tokens = requests_per_minute
        self._last_refill = time.monotonic()
        self._monthly_count = 0
        self._monthly_reset = time.time()
        self._lock = asyncio.Lock()

    def _refill_tokens(self):
        """Refill per-minute tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self._last_refill
        tokens_to_add = elapsed * (self.rpm / 60.0)
        self._minute_tokens = min(self.rpm, self._minute_tokens + tokens_to_add)
        self._last_refill = now

        # Reset monthly counter if month has rolled over
        now_ts = time.time()
        if now_ts - self._monthly_reset > 30 * 24 * 3600:
            self._monthly_count = 0
            self._monthly_reset = now_ts

    async def acquire(self):
        """Wait until a token is available, then consume it."""
        async with self._lock:
            while True:
                self._refill_tokens()
                if self._minute_tokens >= 1 and self._monthly_count < self.monthly_limit:
                    self._minute_tokens -= 1
                    self._monthly_count += 1
                    return
                # Calculate wait time
                wait = (1 - self._minute_tokens) / (self.rpm / 60.0)
                await asyncio.sleep(max(wait, 0.1))

    @property
    def monthly_remaining(self) -> int:
        return max(0, self.monthly_limit - self._monthly_count)


# Shared rate limiters for each API
_limiters: dict[str, RateLimiter] = {}


def get_limiter(name: str, rpm: int = 60, monthly: int = 50000) -> RateLimiter:
    """Get or create a named rate limiter."""
    if name not in _limiters:
        _limiters[name] = RateLimiter(rpm, monthly)
    return _limiters[name]
