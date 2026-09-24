import httpx
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

STRATZ_API_URL = "https://api.stratz.com/graphql"

class StratzClient:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        # Configure client without HTTP/2 to prevent framing errors
        self.client = httpx.AsyncClient(headers=self.headers, http2=False)

    async def get_player_matches(self, account_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch recent matches for a player using Stratz GraphQL."""
        query = """
        query($accountId: Long!, $limit: Int) {
          player(steamAccountId: $accountId) {
            matches(request: {take: $limit}) {
              id
              durationSeconds
              didRadiantWin
              gameMode
              lobbyType
              startDateTime
              players {
                steamAccountId
                heroId
                isRadiant
                kills
                deaths
                assists
                numLastHits
                numDenies
                goldPerMinute
                experiencePerMinute
                level
                heroDamage
                towerDamage
                partyId
              }
            }
          }
        }
        """
        variables = {
            "accountId": account_id,
            "limit": limit
        }
        
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": query, "variables": variables})
            if response.status_code != 200:
                logger.error(f"Stratz get_player_matches 400 body: {response.text}")
            response.raise_for_status()
            data = response.json()
            matches = data.get("data", {}).get("player", {}).get("matches", [])
            
            # Format to match OpenDota style for our sync engine
            formatted_matches = []
            for m in matches:
                # Find the target player
                p_list = m.get("players", [])
                p = next((player for player in p_list if player.get("steamAccountId") == account_id), {})
                
                formatted_matches.append({
                    "match_id": m.get("id"),
                    "hero_id": p.get("heroId"),
                    "radiant_win": m.get("didRadiantWin"),
                    "player_slot": 0 if p.get("isRadiant") else 128, # Approximation
                    "duration": m.get("durationSeconds"),
                    "game_mode": m.get("gameMode"),
                    "lobby_type": m.get("lobbyType"),
                    "start_time": m.get("startDateTime"),
                    "kills": p.get("kills"),
                    "deaths": p.get("deaths"),
                    "assists": p.get("assists"),
                    "gold_per_min": p.get("goldPerMinute"),
                    "xp_per_min": p.get("experiencePerMinute"),
                    "hero_damage": p.get("heroDamage"),
                    "tower_damage": p.get("towerDamage"),
                    "last_hits": p.get("numLastHits"),
                    "denies": p.get("numDenies"),
                    "level": p.get("level"),
                    "party_size": 1 if not p.get("partyId") else 2, # Approximation
                })
            return formatted_matches
        except Exception as e:
            logger.error(f"Stratz get_player_matches error: {e}")
            raise

    async def get_match(self, match_id: int) -> Dict[str, Any]:
        """Fetch deep match data including playback events from Stratz."""
        query = """
        query($matchId: Long!) {
          match(id: $matchId) {
            id
            durationSeconds
            didRadiantWin
            gameMode
            lobbyType
            startDateTime
            players {
              steamAccountId
              heroId
              isRadiant
              kills
              deaths
              assists
              numLastHits
              numDenies
              goldPerMinute
              experiencePerMinute
              level
              heroDamage
              towerDamage
              heroHealing
              networth
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
              stats {
                goldPerMinute
                experiencePerMinute
                lastHitsPerMinute
                deniesPerMinute
              }
              playbackData {
                killEvents {
                  time
                  positionX
                  positionY
                }
                deathEvents {
                  time
                  positionX
                  positionY
                }
                purchaseEvents {
                  time
                  itemId
                }
                goldEvents {
                  time
                  gold
                }
                csEvents {
                  time
                  lastHits
                  denies
                }
              }
            }
          }
        }
        """
        variables = {"matchId": match_id}
        
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": query, "variables": variables})
            if response.status_code != 200:
                logger.error(f"Stratz get_match 400 body: {response.text}")
            response.raise_for_status()
            data = response.json()
            match_data = data.get("data", {}).get("match")
            if not match_data:
                raise ValueError("Match not found on Stratz")
                
            # Format to mimic OpenDota for downstream parsing
            formatted = {
                "match_id": match_data.get("id"),
                "duration": match_data.get("durationSeconds"),
                "radiant_win": match_data.get("didRadiantWin"),
                "game_mode": match_data.get("gameMode"),
                "lobby_type": match_data.get("lobbyType"),
                "start_time": match_data.get("startDateTime"),
                "version": 21, # indicate parsed
                "players": []
            }
            
            for p in match_data.get("players", []):
                # Format Stratz playback logs into OpenDota style logs
                playback = p.get("playbackData") or {}
                stats = p.get("stats") or {}
                
                # Items: Stratz might return item IDs as integers
                # Ward data not available via Stratz playbackData, will rely on OpenDota
                obs_log = []
                sen_log = []
                        
                # Kills
                kills_log = []
                for k in playback.get("killEvents", []):
                    kills_log.append({"time": k.get("time"), "x": k.get("positionX", 0), "y": k.get("positionY", 0)})
                    
                # Purchases
                purchase_log = []
                for b in playback.get("purchaseEvents", []):
                    # We just need the time and key (itemId)
                    purchase_log.append({"time": b.get("time"), "key": str(b.get("itemId"))})
                
                formatted_player = {
                    "account_id": p.get("steamAccountId"),
                    "hero_id": p.get("heroId"),
                    "player_slot": 0 if p.get("isRadiant") else 128,
                    "kills": p.get("kills"),
                    "deaths": p.get("deaths"),
                    "assists": p.get("assists"),
                    "gold_per_min": p.get("goldPerMinute"),
                    "xp_per_min": p.get("experiencePerMinute"),
                    "hero_damage": p.get("heroDamage"),
                    "tower_damage": p.get("towerDamage"),
                    "hero_healing": p.get("heroHealing"),
                    "last_hits": p.get("numLastHits"),
                    "denies": p.get("numDenies"),
                    "level": p.get("level"),
                    "net_worth": p.get("networth"),
                    "obs_placed": 0,
                    "sen_placed": 0,
                    "item_0": p.get("item0Id"),
                    "item_1": p.get("item1Id"),
                    "item_2": p.get("item2Id"),
                    "item_3": p.get("item3Id"),
                    "item_4": p.get("item4Id"),
                    "item_5": p.get("item5Id"),
                    "backpack_0": p.get("backpack0Id"),
                    "backpack_1": p.get("backpack1Id"),
                    "backpack_2": p.get("backpack2Id"),
                    "item_neutral": p.get("neutral0Id"),
                    
                    # Timelines
                    "gold_t": stats.get("goldPerMinute", []),
                    "xp_t": stats.get("experiencePerMinute", []),
                    "lh_t": stats.get("lastHitsPerMinute", []),
                    "dn_t": stats.get("deniesPerMinute", []),
                    
                    # Logs
                    "obs_log": obs_log,
                    "sen_log": sen_log,
                    "kills_log": kills_log,
                    "purchase_log": purchase_log
                }
                formatted["players"].append(formatted_player)
                
            return formatted
        except Exception as e:
            logger.error(f"Stratz get_match error: {e}")
            raise

def get_stratz_client(api_token: Optional[str]) -> Optional[StratzClient]:
    if not api_token:
        return None
    return StratzClient(api_token)
