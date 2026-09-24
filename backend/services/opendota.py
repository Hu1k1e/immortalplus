"""
OpenDota API client.
Primary data source for match history, player stats, hero data, and parsed replays.

API Docs: https://docs.opendota.com/
Rate Limit: 60 req/min, 50,000 req/month (free tier)
"""

import logging
from typing import Any, Optional

import httpx

from config import OPENDOTA_BASE_URL
from utils.rate_limiter import get_limiter
from utils.cache import get_cached, set_cached

logger = logging.getLogger(__name__)

# Rate limiter for OpenDota
_limiter = get_limiter("opendota", rpm=55, monthly=45000)  # Buffer below actual limit


class OpenDotaClient:
    """Async client for the OpenDota API."""

    def __init__(self, api_key: Optional[str] = None):
        self.base_url = OPENDOTA_BASE_URL
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
                headers={"Accept": "application/json"},
            )
        return self._client

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        """Make a rate-limited request to the OpenDota API."""
        await _limiter.acquire()

        client = await self._get_client()
        params = kwargs.pop("params", {})
        if self.api_key:
            params["api_key"] = self.api_key

        try:
            resp = await client.request(method, path, params=params, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenDota API error: {e.response.status_code} for {path}")
            if e.response.status_code == 429:
                logger.warning("OpenDota rate limit hit — backing off")
            raise
        except httpx.RequestError as e:
            logger.error(f"OpenDota request failed: {e}")
            raise

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ── Player endpoints ──────────────────────────────────────────

    async def get_player(self, account_id: int) -> dict:
        """Get player profile data."""
        cached = get_cached("player", "profile", account_id)
        if cached:
            return cached
        data = await self._request("GET", f"/players/{account_id}")
        set_cached("player", "profile", account_id, value=data, ttl=1800)
        return data

    async def get_player_wl(self, account_id: int, **filters) -> dict:
        """Get player win/loss counts. Filters: limit, hero_id, game_mode, date, etc."""
        data = await self._request("GET", f"/players/{account_id}/wl", params=filters)
        return data

    async def get_player_recent_matches(self, account_id: int) -> list:
        """Get last 20 matches for a player."""
        return await self._request("GET", f"/players/{account_id}/recentMatches")

    async def get_player_matches(self, account_id: int, **filters) -> list:
        """
        Get player match history.
        Filters: limit, offset, hero_id, game_mode, lobby_type, date, significant, etc.
        """
        data = await self._request(
            "GET", f"/players/{account_id}/matches", params=filters
        )
        return data

    async def get_player_heroes(self, account_id: int, **filters) -> list:
        """Get per-hero stats for a player."""
        cached = get_cached("player", "heroes", account_id)
        if cached:
            return cached
        data = await self._request(
            "GET", f"/players/{account_id}/heroes", params=filters
        )
        set_cached("player", "heroes", account_id, value=data, ttl=3600)
        return data

    async def get_player_totals(self, account_id: int, **filters) -> list:
        """Get aggregate stat totals (KDA, GPM, XPM, etc.)."""
        return await self._request(
            "GET", f"/players/{account_id}/totals", params=filters
        )

    async def get_player_peers(self, account_id: int) -> list:
        """Get most played-with players."""
        return await self._request("GET", f"/players/{account_id}/peers")

    async def get_player_wardmap(self, account_id: int) -> dict:
        """Get ward placement heatmap data."""
        return await self._request("GET", f"/players/{account_id}/wardmap")

    async def refresh_player(self, account_id: int) -> dict:
        """Trigger a match history refresh for this player."""
        return await self._request("POST", f"/players/{account_id}/refresh")

    # ── Match endpoints ───────────────────────────────────────────

    async def get_match(self, match_id: int) -> dict:
        """
        Get full match details.
        If the match has been parsed, includes gold_t, xp_t, obs_log, etc.
        """
        cached = get_cached("match", "details", match_id)
        if cached:
            return cached
        data = await self._request("GET", f"/matches/{match_id}")
        # Cache parsed matches longer
        ttl = 86400 if data.get("version") else 3600
        set_cached("match", "details", match_id, value=data, ttl=ttl)
        return data

    async def request_parse(self, match_id: int) -> dict:
        """Request OpenDota to parse a replay."""
        return await self._request("POST", f"/request/{match_id}")

    # ── Hero endpoints ────────────────────────────────────────────

    async def get_hero_stats(self) -> list:
        """Get stats for all heroes (pick/win/ban rates by bracket)."""
        cached = get_cached("meta", "hero_stats")
        if cached:
            return cached
        data = await self._request("GET", "/heroStats")
        set_cached("meta", "hero_stats", value=data)
        return data

    async def get_hero_matchups(self, hero_id: int) -> list:
        """Get hero vs hero matchup data."""
        cached = get_cached("matchups", "hero", hero_id)
        if cached:
            return cached
        data = await self._request("GET", f"/heroes/{hero_id}/matchups")
        set_cached("matchups", "hero", hero_id, value=data)
        return data

    async def get_heroes(self) -> list:
        """Get list of all heroes."""
        cached = get_cached("meta", "heroes_list")
        if cached:
            return cached
        data = await self._request("GET", "/heroes")
        set_cached("meta", "heroes_list", value=data, ttl=86400)
        return data

    # ── Benchmark endpoints ───────────────────────────────────────

    async def get_benchmarks(self, hero_id: int) -> dict:
        """Get performance benchmarks for a hero."""
        cached = get_cached("meta", "benchmarks", hero_id)
        if cached:
            return cached
        data = await self._request("GET", f"/benchmarks", params={"hero_id": hero_id})
        set_cached("meta", "benchmarks", hero_id, value=data)
        return data

    # ── Explorer ──────────────────────────────────────────────────

    async def explorer_query(self, sql: str) -> dict:
        """Run a custom SQL query against the OpenDota database."""
        return await self._request("GET", "/explorer", params={"sql": sql})

    # ── Distributions ─────────────────────────────────────────────

    async def get_distributions(self) -> dict:
        """Get rank distribution data."""
        cached = get_cached("meta", "distributions")
        if cached:
            return cached
        data = await self._request("GET", "/distributions")
        set_cached("meta", "distributions", value=data, ttl=86400)
        return data


# Module-level singleton
_client: Optional[OpenDotaClient] = None


def get_opendota_client(api_key: Optional[str] = None) -> OpenDotaClient:
    """Get or create the OpenDota API client singleton."""
    global _client
    if _client is None:
        _client = OpenDotaClient(api_key)
    elif api_key and _client.api_key != api_key:
        _client.api_key = api_key
    return _client
