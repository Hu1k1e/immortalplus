import httpx
import logging
from typing import Dict, Any, Optional

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
