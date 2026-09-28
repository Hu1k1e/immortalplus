import httpx
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

STRATZ_API_URL = "https://api.stratz.com/graphql"


# Our app's rank_bracket is 1-8 (Herald..Immortal, see
# utils/dota_constants.py RANK_BRACKETS); Stratz's RankBracketBasicEnum
# only has 4 paired tiers. Confirmed via their real schema
# (RankBracketBasicEnum.cs) — not a guess.
_RANK_BRACKET_TO_STRATZ = {
    1: "HERALD_GUARDIAN", 2: "HERALD_GUARDIAN",
    3: "CRUSADER_ARCHON", 4: "CRUSADER_ARCHON",
    5: "LEGEND_ANCIENT", 6: "LEGEND_ANCIENT",
    7: "DIVINE_IMMORTAL", 8: "DIVINE_IMMORTAL",
}


def rank_bracket_to_stratz(rank_bracket: Optional[int]) -> str:
    return _RANK_BRACKET_TO_STRATZ.get(rank_bracket, "ALL")


def _parse_stratz_position(position: Optional[str]) -> Optional[int]:
    """"POSITION_1".."POSITION_5" -> 1..5; "UNKNOWN"/"FILTERED"/"ALL"/None -> None."""
    if not position or not position.startswith("POSITION_"):
        return None
    try:
        n = int(position.rsplit("_", 1)[1])
        return n if 1 <= n <= 5 else None
    except (ValueError, IndexError):
        return None


class StratzClient:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            # Stratz's own API docs (stratz.com/api) explicitly require
            # this exact header on every request: "Please ensure that all
            # API requests include the header User-Agent: STRATZ_API".
            # This was a browser-spoofed UA instead — real candidate for
            # why heroStats.stats/matchUp were returning HTTP 200 with no
            # GraphQL error but zero rows for every hero: a server quietly
            # filtering unidentified clients rather than rejecting them
            # outright fits that evidence exactly. get_player_matches/
            # get_match kept working regardless, which fits too if the
            # UA requirement specifically gates these proprietary
            # analytics endpoints rather than basic match/player data.
            "User-Agent": "STRATZ_API",
        }
        # Configure client without HTTP/2 to prevent framing errors
        self.client = httpx.AsyncClient(headers=self.headers, http2=False)

    async def get_player_matches(self, account_id: int, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        """Fetch matches for a player using Stratz GraphQL. skip enables
        paging back through a player's FULL history (see
        services/sync.py's sync_full_match_history), not just their most
        recent `limit` games."""
        query = """
        query($accountId: Long!, $limit: Int, $skip: Int) {
          player(steamAccountId: $accountId) {
            matches(request: {take: $limit, skip: $skip}) {
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
                position
              }
            }
          }
        }
        """
        variables = {
            "accountId": account_id,
            "limit": limit,
            "skip": skip,
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
                    # Stratz computes the real 1-5 position itself (far
                    # better than our own lane+GPM guess — confirmed via
                    # their real schema, MatchPlayerType.position, enum
                    # POSITION_1..POSITION_5/UNKNOWN/FILTERED/ALL) — parse
                    # "POSITION_3" -> 3, anything else (unknown/missing) -> None.
                    "position": _parse_stratz_position(p.get("position")),
                })
            return formatted_matches
        except Exception as e:
            logger.error(f"Stratz get_player_matches error: {e}")
            raise

    async def get_player_hero_position_performance(self, account_id: int) -> List[Dict[str, Any]]:
        """
        Real per-hero, per-position match/win counts for ONE player,
        computed server-side by Stratz from the account's COMPLETE match
        history (Player.heroesPerformance[].positionScore[] — confirmed
        directly against Stratz's real schema, PlayerHeroesPerformanceType
        / PlayerHeroesPerformanceScoreType). This is the accurate
        replacement for "your best per position": previously this app
        only had its own locally-synced Match rows to bucket by position
        (services/draft_engine.py's compute_personal_position_stats),
        which for a freshly-linked account meant however many recent
        games had accumulated since linking, not the real complete
        history — this query needs no local backfill at all, since
        Stratz already has the full history and does the aggregation.

        Returns a flat list of {hero_id, position, matches, wins} rows
        (one row per hero per position the player has actually played),
        skipping any position bucket with zero matches.
        """
        query = """
        query($accountId: Long!, $take: Int) {
          player(steamAccountId: $accountId) {
            heroesPerformance(take: $take) {
              heroId
              matchCount
              winCount
              positionScore {
                id
                matchCount
                winCount
              }
            }
          }
        }
        """
        # 150 comfortably covers every hero in the game (~126 as of this
        # writing) — heroesPerformance has no separate "give me all of
        # them" flag, just take/skip pagination, so this is set high
        # enough that no real account's per-hero list gets truncated.
        variables = {"accountId": account_id, "take": 150}
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": query, "variables": variables})
            if response.status_code != 200:
                logger.error(f"Stratz get_player_hero_position_performance {response.status_code} body: {response.text[:2000]}")
            response.raise_for_status()
            data = response.json()

            if data.get("errors"):
                logger.error(f"Stratz get_player_hero_position_performance GraphQL errors for {account_id}: {data['errors']}")

            heroes = ((data.get("data") or {}).get("player") or {}).get("heroesPerformance") or []
            rows = []
            for h in heroes:
                hero_id = h.get("heroId")
                if not hero_id:
                    continue
                for ps in h.get("positionScore") or []:
                    position = _parse_stratz_position(ps.get("id"))
                    matches = ps.get("matchCount") or 0
                    if position is None or matches <= 0:
                        continue
                    rows.append({
                        "hero_id": hero_id,
                        "position": position,
                        "matches": matches,
                        "wins": ps.get("winCount") or 0,
                    })

            if not rows and heroes:
                # heroesPerformance itself came back non-empty, but no
                # position breakdown survived — log the raw shape once
                # rather than silently returning an empty result, same
                # lesson as the matchUp/hero_synergy failure elsewhere in
                # this file (an empty-looking result with no logged
                # reason cost real time to diagnose).
                logger.warning(
                    f"Stratz get_player_hero_position_performance: {len(heroes)} heroes returned but "
                    f"0 usable position rows for account {account_id} — sample: {heroes[:2]}"
                )
            return rows
        except Exception as e:
            logger.error(f"Stratz get_player_hero_position_performance error for {account_id}: {e}")
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
            clusterId
            replaySalt
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
                # Requested in the query above but was previously dropped here —
                # resolve_cluster_salt()'s Stratz fallback reads these exact keys
                # and was always getting None/None as a result.
                "clusterId": match_data.get("clusterId"),
                "replaySalt": match_data.get("replaySalt"),
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

    async def request_parse(self, match_id: int) -> bool:
        """Request Stratz to parse a match."""
        mutation = """
        mutation($matchId: Long!) {
          retryMatchParse(matchId: $matchId)
        }
        """
        variables = {"matchId": match_id}
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": mutation, "variables": variables})
            response.raise_for_status()
            data = response.json()
            return data.get("data", {}).get("retryMatchParse") is True
        except Exception as e:
            logger.error(f"Stratz request_parse error: {e}")
            return False

    async def get_hero_synergy_and_matchups(self, hero_id: int, bracket_basic: str = "ALL") -> Dict[str, List[Dict[str, Any]]]:
        """
        Real ally-synergy and enemy-matchup data for one hero, from
        Stratz's heroStats.matchUp query — confirmed directly against
        their real GraphQL schema (STRATZ.HeroStatsQuery.MatchUp ->
        HeroDryadType.with/vs -> HeroStatsHeroDryadType.synergy). Returns
        {"with": [{hero_id, synergy, matches, winrate}, ...],
         "vs": [...]} — hero_id in each entry is the OTHER hero in the pair.

        Real root cause, confirmed by running several query-shape variants
        directly against Stratz for a real hero (via a temporary debug
        endpoint) rather than guessing further from an SDK's parameter
        list: bracketBasicIds: ["ALL"] — not skip/take, not heroId vs
        heroIds — is what silently zeroes this query out. The exact same
        query with bracketBasicIds omitted entirely returned real data
        (Anti-Mage: 10 real "with" pairs, 10 real "vs" pairs, real
        synergy/winrate/matchCount numbers) on the first try. "ALL" is
        apparently not a real wildcard value for this particular field,
        unlike bracket-specific values which presumably do work (not
        needed here — this app only ever queries the unfiltered case).
        bracketBasicIds is no longer sent at all. bracket_basic is kept
        as an accepted-but-unused param so the call site doesn't need to
        change if a real bracket filter is added later.
        """
        query = """
        query($heroIds: [Short]) {
          heroStats {
            matchUp(heroIds: $heroIds) {
              heroId
              with {
                heroId2
                synergy
                winRateHeroId1
                matchCount
              }
              vs {
                heroId2
                synergy
                winRateHeroId1
                matchCount
              }
            }
          }
        }
        """
        variables = {"heroIds": [hero_id]}
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": query, "variables": variables})
            if response.status_code != 200:
                logger.error(f"Stratz get_hero_synergy_and_matchups {response.status_code} body: {response.text[:2000]}")
            response.raise_for_status()
            data = response.json()

            # A 200 response doesn't rule out a GraphQL-level error with
            # partial/empty data — confirmed this exact failure mode was
            # silent elsewhere in this file (get_hero_position_stats) and
            # produced zero rows with no logged reason. Always log it here too.
            if data.get("errors"):
                logger.error(f"Stratz get_hero_synergy_and_matchups GraphQL errors for hero {hero_id}: {data['errors']}")

            matchup_list = ((data.get("data") or {}).get("heroStats") or {}).get("matchUp") or []
            match_up = matchup_list[0] if matchup_list else {}

            def _format(entries):
                out = []
                for e in entries or []:
                    if e.get("heroId2") is None:
                        continue
                    out.append({
                        "hero_id": e["heroId2"],
                        "synergy": e.get("synergy"),
                        "matches": e.get("matchCount") or 0,
                        "winrate": e.get("winRateHeroId1"),
                    })
                return out

            result = {"with": _format(match_up.get("with")), "vs": _format(match_up.get("vs"))}
            if not result["with"] and not result["vs"]:
                logger.warning(
                    f"Stratz get_hero_synergy_and_matchups: hero {hero_id} returned 0 with/vs "
                    f"rows (raw matchUp entries: {len(matchup_list)}, errors: {data.get('errors')})"
                )
            return result
        except Exception as e:
            logger.error(f"Stratz get_hero_synergy_and_matchups error for hero {hero_id}: {e}")
            raise

    async def get_hero_position_stats(self, bracket_basic: str = "ALL", hero_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Per-hero, per-position match count/winrate — from Stratz's
        heroStats.stats query, grouped by position (STRATZ.HeroStatsQuery.
        Stats -> HeroPositionTimeDetailType, confirmed directly against
        their real schema). This is the same underlying data
        Dota2ProTracker's site displays (Stratz's own API page lists
        ProTracker as built on this API) — querying it directly here
        means the fragile Playwright-based scrape of ProTracker's page
        (see services/protracker.py) isn't the only source;
        sync_hero_position_meta tries this first and only falls back to
        the scrape if Stratz isn't configured or fails.

        hero_ids is passed explicitly (all real hero IDs, by default)
        rather than omitted: confirmed in production that omitting it
        silently returns zero rows instead of "all heroes" as first
        assumed (root-caused after this returned empty with no logged
        error — see the raise-on-empty and error-array logging below,
        added specifically because that failure was silent before).
        """
        if hero_ids is None:
            from utils.dota_constants import HEROES
            hero_ids = list(HEROES.keys())

        query = """
        query($heroIds: [Short], $bracketBasicIds: [RankBracketBasicEnum]) {
          heroStats {
            stats(heroIds: $heroIds, bracketBasicIds: $bracketBasicIds, groupByPosition: true) {
              heroId
              position
              matchCount
              winCount
            }
          }
        }
        """
        variables = {"heroIds": hero_ids, "bracketBasicIds": [bracket_basic]}
        try:
            response = await self.client.post(STRATZ_API_URL, json={"query": query, "variables": variables})
            if response.status_code != 200:
                logger.error(f"Stratz get_hero_position_stats {response.status_code} body: {response.text[:2000]}")
            response.raise_for_status()
            data = response.json()

            # GraphQL can return HTTP 200 with an "errors" array and
            # partial/empty "data" — that's exactly the failure mode that
            # was silently producing zero rows before. Always log it.
            if data.get("errors"):
                logger.error(f"Stratz get_hero_position_stats GraphQL errors: {data['errors']}")

            stats = ((data.get("data") or {}).get("heroStats") or {}).get("stats") or []

            rows = []
            for s in stats:
                position = _parse_stratz_position(s.get("position"))
                matches = s.get("matchCount") or 0
                wins = s.get("winCount") or 0
                if position is None or not s.get("heroId") or matches <= 0:
                    continue
                rows.append({
                    "hero_id": s["heroId"],
                    "position": position,
                    "matches": matches,
                    "winrate": wins / matches,
                    "d2pt_rating": None,  # Stratz has no equivalent of ProTracker's own branded rating stat
                })

            if not rows:
                # Treat empty as a real failure, not a quiet success — an
                # empty result here used to fall through to the
                # Dota2ProTracker fallback with zero explanation logged.
                raise ValueError(
                    f"Stratz returned 0 usable hero/position rows (raw stats entries: {len(stats)}, "
                    f"errors: {data.get('errors')})"
                )
            return rows
        except Exception as e:
            logger.error(f"Stratz get_hero_position_stats error: {e}")
            raise


def get_stratz_client(api_token: Optional[str]) -> Optional[StratzClient]:
    if not api_token:
        return None
    return StratzClient(api_token)
