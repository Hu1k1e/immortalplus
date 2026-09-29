import json
import httpx
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class SteamClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.steampowered.com/IDOTA2Match_570"

    async def get_match_details(self, match_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch match details directly from the Steam API.
        This provides the cluster and replay_salt necessary for downloading replays.
        """
        if not self.api_key:
            logger.warning("Steam API key not provided.")
            return None

        url = f"{self.base_url}/GetMatchDetails/v1/"
        params = {
            "key": self.api_key,
            "match_id": match_id
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    match_data = data.get("result", {})
                    
                    if "error" in match_data:
                        logger.error(f"Steam API returned error: {match_data['error']}")
                        return None
                        
                    return match_data
                else:
                    logger.error(f"Steam API returned {response.status_code}: {response.text}")
                    return None
            except Exception as e:
                logger.error(f"Error fetching from Steam API: {e}")
                return None

    async def get_match_history(self, account_id: int, matches_requested: int = 25) -> Optional[list]:
        """
        This player's own recent match IDs, straight from Steam
        (IDOTA2Match_570/GetMatchHistory) — only returns results if the
        account has "Expose Public Match Data" enabled in the Dota 2
        client (a per-account opt-in, unrelated to Steam profile privacy).
        Used as a fast-path new-match detector: this call is cheap and
        doesn't depend on OpenDota/Stratz having noticed the match yet, so
        polling it frequently (see main.py's steam_match_poll_loop) can
        surface a just-finished match within a minute or two instead of
        waiting for the ~30-minute general sync cycle. Only basic fields
        are returned here (match_id, start_time, lobby_type, per-player
        hero_id) — NOT full stats, which still come from the existing
        OpenDota/Stratz enrichment pipeline once a new match_id is found.

        Returns the raw `result.matches` list, or None on failure/if the
        account doesn't have public match data exposed (status != 1).
        """
        if not self.api_key:
            return None

        url = f"{self.base_url}/GetMatchHistory/v1/"
        params = {"key": self.api_key, "account_id": account_id, "matches_requested": matches_requested}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    logger.error(f"Steam API GetMatchHistory returned {response.status_code}: {response.text}")
                    return None
                result = response.json().get("result", {})
                if result.get("status") != 1:
                    # status 15 = private match data (most common non-error
                    # case — the account simply hasn't enabled the setting),
                    # logged at info rather than error since it's expected
                    # for any account that hasn't opted in.
                    logger.info(f"Steam GetMatchHistory for {account_id}: status={result.get('status')} ({result.get('statusDetail', 'no detail')})")
                    return None
                return result.get("matches", [])
            except Exception as e:
                logger.error(f"Error fetching match history from Steam API: {e}")
                return None

    async def get_player_summary(self, steam_id_64: str) -> Optional[Dict[str, Any]]:
        """
        Persona name / avatar / profile URL straight from the Steam Web API
        (ISteamUser/GetPlayerSummaries) — a fallback for when OpenDota's own
        /players/{id} response comes back without a cached `profile` block
        (happens for accounts OpenDota hasn't indexed yet; persona name and
        avatar are public Steam data even on an otherwise-private profile,
        unlike match history, so this still works in that case).
        """
        if not self.api_key:
            return None

        url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
        params = {"key": self.api_key, "steamids": steam_id_64}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=params)
                if response.status_code != 200:
                    logger.error(f"Steam API GetPlayerSummaries returned {response.status_code}: {response.text}")
                    return None
                players = response.json().get("response", {}).get("players", [])
                return players[0] if players else None
            except Exception as e:
                logger.error(f"Error fetching player summary from Steam API: {e}")
                return None


async def resolve_cluster_salt(
    match,
    od_client,
    steam_api_key: Optional[str] = None,
    stratz_data: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[int], Optional[int]]:
    """
    Resolve (cluster, replay_salt) for a match's replay download, trying the
    most reliable/fastest source first. Used by every entry point that needs
    to download a replay (auto-parse worker, manual "Parse Replay" button,
    fetch_match_details fallback) so they all behave consistently.

    Order:
    1. Already-stored opendota_raw on the match record (free, no network).
    2. Steam Web API directly (fast, reliable — doesn't depend on OpenDota
       having finished fetching GC data for this match, which can lag).
    3. A fresh (cache-bypassing) OpenDota /matches/{id} call.
    4. Stratz data, if already fetched by the caller.
    """
    cluster, salt = None, None

    if getattr(match, "opendota_raw", None):
        try:
            raw = json.loads(match.opendota_raw)
            cluster = raw.get("cluster")
            salt = raw.get("replay_salt")
        except (json.JSONDecodeError, TypeError):
            pass

    if (not cluster or not salt) and steam_api_key:
        steam_client = SteamClient(steam_api_key)
        steam_data = await steam_client.get_match_details(match.match_id)
        if steam_data:
            cluster = steam_data.get("cluster") or cluster
            salt = steam_data.get("replay_salt") or salt

    if not cluster or not salt:
        try:
            fresh = await od_client._request("GET", f"/matches/{match.match_id}")
            cluster = fresh.get("cluster") or cluster
            salt = fresh.get("replay_salt") or salt
            if fresh and not getattr(match, "opendota_raw", None):
                match.opendota_raw = json.dumps(fresh)
        except Exception as e:
            logger.warning(f"[{match.match_id}] Fresh OpenDota lookup for cluster/salt failed: {e}")

    if (not cluster or not salt) and stratz_data:
        cluster = stratz_data.get("clusterId") or cluster
        salt = stratz_data.get("replaySalt") or salt

    return cluster, salt
