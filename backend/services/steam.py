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
