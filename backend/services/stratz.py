"""
Stratz GraphQL API client.
Provides rank-bracket-specific hero stats, matchups, synergies, and meta trends.

API: https://api.stratz.com/graphql
Playground: https://api.stratz.com/graphiql/
Auth: Bearer token from Stratz website (Steam login)
"""

import logging
from typing import Any, Optional

import httpx

from config import STRATZ_BASE_URL
from utils.cache import get_cached, set_cached
from utils.rate_limiter import get_limiter

logger = logging.getLogger(__name__)

_limiter = get_limiter("stratz", rpm=100, monthly=500000)


class StratzClient:
    """Async client for the Stratz GraphQL API."""

    def __init__(self, api_token: Optional[str] = None):
        self.api_url = STRATZ_BASE_URL
        self.api_token = api_token
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            if self.api_token:
                headers["Authorization"] = f"Bearer {self.api_token}"
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers=headers,
            )
        return self._client

    async def _query(self, query: str, variables: Optional[dict] = None) -> dict:
        """Execute a GraphQL query against the Stratz API."""
        await _limiter.acquire()
        client = await self._get_client()

        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            resp = await client.post(self.api_url, json=payload)
            resp.raise_for_status()
            result = resp.json()

            if "errors" in result:
                logger.warning(f"Stratz GraphQL errors: {result['errors']}")

            return result.get("data", {})
        except httpx.HTTPStatusError as e:
            logger.error(f"Stratz API error: {e.response.status_code}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Stratz request failed: {e}")
            raise

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ── Hero meta by rank bracket ─────────────────────────────────

    async def get_hero_stats_by_bracket(
        self, bracket: Optional[int] = None, take: int = 20
    ) -> list:
        """
        Get hero stats (winrate, pick count, ban count) filtered by rank bracket.
        Bracket: 1=Herald, 2=Guardian, ..., 7=Divine, 8=Immortal
        """
        cache_key = f"stratz_hero_stats_{bracket}"
        cached = get_cached("meta", cache_key)
        if cached:
            return cached

        bracket_filter = f"bracketBasicIds: [{bracket}]" if bracket else ""
        query = f"""
        {{
            heroStats {{
                winDay(take: {take} {bracket_filter}) {{
                    heroId
                    winCount
                    matchCount
                    day
                }}
            }}
        }}
        """
        data = await self._query(query)
        result = data.get("heroStats", {}).get("winDay", [])
        set_cached("meta", cache_key, value=result)
        return result

    async def get_hero_meta_trends(self, bracket: Optional[int] = None) -> list:
        """Get hero pick/win/ban rates for current patch by rank bracket."""
        cache_key = f"stratz_meta_trends_{bracket}"
        cached = get_cached("meta", cache_key)
        if cached:
            return cached

        bracket_filter = (
            f"positionIds: null, bracketBasicIds: [{bracket}]" if bracket else ""
        )
        query = f"""
        {{
            heroStats {{
                stats({bracket_filter}) {{
                    heroId
                    matchCount
                    winCount
                    banCount
                }}
            }}
        }}
        """
        data = await self._query(query)
        result = data.get("heroStats", {}).get("stats", [])
        set_cached("meta", cache_key, value=result)
        return result

    # ── Hero matchups ─────────────────────────────────────────────

    async def get_hero_matchups(
        self, hero_id: int, bracket: Optional[int] = None
    ) -> list:
        """Get matchup data for a specific hero against all opponents."""
        cache_key = f"stratz_matchup_{hero_id}_{bracket}"
        cached = get_cached("matchups", cache_key)
        if cached:
            return cached

        bracket_filter = f"bracketBasicIds: [{bracket}]" if bracket else ""
        query = f"""
        {{
            heroStats {{
                heroVsHeroMatchup(heroId: {hero_id} {bracket_filter}) {{
                    advantage {{
                        heroId
                        with {{
                            heroId2
                            matchCount
                            winCount
                        }}
                        vs {{
                            heroId2
                            matchCount
                            winCount
                        }}
                    }}
                }}
            }}
        }}
        """
        data = await self._query(query)
        result = (
            data.get("heroStats", {}).get("heroVsHeroMatchup", {}).get("advantage", [])
        )
        set_cached("matchups", cache_key, value=result)
        return result

    # ── Player data ───────────────────────────────────────────────

    async def get_player_hero_performance(
        self, steam_id: int, hero_id: Optional[int] = None
    ) -> dict:
        """Get a player's hero-specific performance."""
        hero_filter = f"heroId: {hero_id}" if hero_id else ""
        query = f"""
        {{
            player(steamAccountId: {steam_id}) {{
                heroesPerformance({hero_filter}) {{
                    heroId
                    matchCount
                    winCount
                    avgKills
                    avgDeaths
                    avgAssists
                    avgGpm
                    avgXpm
                    lastPlayedDateTime
                }}
            }}
        }}
        """
        data = await self._query(query)
        return data.get("player", {}).get("heroesPerformance", [])

    # ── Match details ─────────────────────────────────────────────

    async def get_match_details(self, match_id: int) -> dict:
        """Get detailed match data from Stratz."""
        query = f"""
        {{
            match(id: {match_id}) {{
                id
                didRadiantWin
                durationSeconds
                gameMode
                lobbyType
                rank
                players {{
                    heroId
                    isRadiant
                    kills
                    deaths
                    assists
                    goldPerMinute
                    experiencePerMinute
                    heroDamage
                    towerDamage
                    heroHealing
                    numLastHits
                    numDenies
                    level
                    lane
                    role
                    imp
                    award
                    item0Id
                    item1Id
                    item2Id
                    item3Id
                    item4Id
                    item5Id
                    backpack0Id
                    backpack1Id
                    backpack2Id
                    neutral0Id
                }}
            }}
        }}
        """
        data = await self._query(query)
        return data.get("match", {})

    # ── Constants ─────────────────────────────────────────────────

    async def get_game_version(self) -> dict:
        """Get current game version/patch info."""
        query = """
        {
            constants {
                gameVersions {
                    id
                    name
                    date
                }
            }
        }
        """
        data = await self._query(query)
        versions = data.get("constants", {}).get("gameVersions", [])
        return versions[-1] if versions else {}


# Module-level singleton
_client: Optional[StratzClient] = None


def get_stratz_client(api_token: Optional[str] = None) -> StratzClient:
    """Get or create the Stratz client singleton."""
    global _client
    if _client is None:
        _client = StratzClient(api_token)
    elif api_token and _client.api_token != api_token:
        _client.api_token = api_token
    return _client
