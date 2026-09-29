"""
Background sync service.
Handles periodic data fetching from APIs, progress snapshot creation,
and match history synchronization.
"""

import asyncio
import json
import logging
from datetime import datetime, date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlmodel import select

from models import (
    Match, Player, ProgressSnapshot, HeroMeta, HeroMatchup, HeroSynergy, UserSettings,
)
from services.opendota import get_opendota_client
from services.analysis_engine import analyze_match
from services.local_parser import parse_match_locally
from services.position_parser import parse_hero_positions
from services.steam import resolve_cluster_salt, SteamClient
from services.replay_compute import apply_computed_fields
from models import MatchAnalysis

logger = logging.getLogger(__name__)

# Shared between background_sync_loop (main.py) and the manual "Refresh
# Meta Data" button (routers/draft.py) — both call the same sequence of
# external syncs (hero_meta, hero_matchups, hero_position_meta,
# hero_synergy) with no coordination before this, so a manual refresh
# triggered while the periodic loop was mid-cycle ran concurrently with
# it: both competing for the same OpenDota/Stratz rate limits, each
# taking noticeably longer, and a data-health check landing in that
# window could show a source as "stale" simply because its cycle hadn't
# committed yet — not because syncing was actually broken. This lock
# makes the two paths take turns instead of overlapping.
meta_sync_lock = asyncio.Lock()


def _match_row_from_dict(m: dict, player_id: int) -> Match:
    """Builds an unsaved Match ORM row from one OpenDota- or Stratz-shaped
    match dict (both services/opendota.py and services/stratz.py normalize
    to this same field set). Shared by sync_player_matches (incremental,
    newest-forward) and sync_full_match_history (backfill, all history) so
    a stored match looks identical regardless of which path fetched it."""
    player_slot = m.get("player_slot", 0)
    radiant_win = m.get("radiant_win")
    is_radiant = player_slot < 128
    result = None
    if radiant_win is not None:
        result = "win" if (is_radiant == radiant_win) else "loss"

    return Match(
        match_id=m["match_id"],
        player_id=player_id,
        hero_id=m.get("hero_id", 0),
        result=result,
        game_mode=m.get("game_mode"),
        lobby_type=m.get("lobby_type"),
        duration=m.get("duration"),
        kills=m.get("kills"),
        deaths=m.get("deaths"),
        assists=m.get("assists"),
        gpm=m.get("gold_per_min"),
        xpm=m.get("xp_per_min"),
        hero_damage=m.get("hero_damage"),
        tower_damage=m.get("tower_damage"),
        hero_healing=m.get("hero_healing"),
        last_hits=m.get("last_hits"),
        denies=m.get("denies"),
        level=m.get("level"),
        lane=m.get("lane"),
        lane_role=m.get("lane_role"),
        position=m.get("position"),
        party_size=m.get("party_size"),
        player_slot=player_slot,
        radiant_win=radiant_win,
        avg_rank_tier=m.get("average_rank"),
        played_at=datetime.utcfromtimestamp(m["start_time"]) if m.get("start_time") else None,
    )


async def sync_player_matches(session: Session, player: Player, settings: UserSettings):
    """
    Fetch new matches from OpenDota and store them in the database.
    Only fetches matches newer than the last synced match — this is the
    regular per-cycle incremental sync, NOT a full history fetch (see
    sync_full_match_history for that; a freshly-linked account only gets
    its most recent 50 games from this path, since it filters to
    match_id > whatever's already stored rather than paging backward).
    """
    if not player.account_id:
        logger.warning(f"Player {player.steam_id} has no account_id — skipping sync")
        return 0

    # Fetch recent matches
    source = settings.data_source if settings else "both"
    matches = None

    # Find the most recent match we have
    stmt = (
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.match_id.desc())
        .limit(1)
    )
    latest = session.exec(stmt).first()
    last_match_id = latest.match_id if latest else 0

    if source in ["stratz", "both"]:
        from services.stratz import get_stratz_client
        stratz_client = get_stratz_client(settings.stratz_api_token if settings else None)
        if stratz_client:
            try:
                matches = await stratz_client.get_player_matches(player.account_id, limit=50)
            except Exception as e:
                logger.error(f"Failed to fetch matches from Stratz for {player.account_id}: {e}")
                if source == "stratz":
                    return 0

    if not matches and source in ["opendota", "both"]:
        client = get_opendota_client(settings.opendota_api_key if settings else None)
        try:
            matches = await client.get_player_matches(
                player.account_id,
                limit=50,
                significant=0,  # Include all matches
            )
        except Exception as e:
            logger.error(f"Failed to fetch matches from OpenDota for {player.account_id}: {e}")
            return 0

    if not matches:
        return 0

    new_count = 0
    for m in matches:
        mid = m.get("match_id")
        if not mid or mid <= last_match_id:
            continue

        # Check if we already have this match
        existing = session.exec(select(Match).where(Match.match_id == mid)).first()
        if existing:
            continue

        session.add(_match_row_from_dict(m, player.id))
        new_count += 1

    if new_count > 0:
        player.last_sync_at = datetime.utcnow()
        session.commit()
        logger.info(f"Synced {new_count} new matches for player {player.account_id}")

        # Auto-parse replays if enabled
        if getattr(settings, 'auto_parse_replays', False):
            # Just do OpenDota parse requests. Stratz parses everything automatically.
            od_client = get_opendota_client(settings.opendota_api_key if settings else None)
            for m in matches:
                mid = m.get("match_id") or m.get("id")
                if mid and mid > last_match_id:
                    try:
                        await od_client.request_parse(mid)
                        logger.info(f"Auto-requested parse for new match {mid}")
                    except Exception as e:
                        logger.error(f"Failed to auto-request parse for {mid}: {e}")

    return new_count


def _steam_match_to_dict(details: dict, player_data: dict) -> dict:
    """Normalizes one Steam GetMatchDetails response (+ the requesting
    player's entry within its `players` array) to the same shape
    _match_row_from_dict expects. Steam's own match-details endpoint
    already carries full per-player stats (kills/deaths/gpm/items/etc —
    confirmed against its real response shape, the same one
    resolve_cluster_salt already reads cluster/replay_salt from), so a
    match discovered this way doesn't need to wait on OpenDota/Stratz for
    its basic stats at all. Not present here (Steam's raw API doesn't
    compute them): lane/lane_role/position, party_size, average_rank —
    left null, same as this app already handles for other sources missing
    them; deep fields (gold_t, purchase_log, all_players, etc.) arrive
    later via the existing auto-parse pipeline, same as any other match.
    """
    return {
        "match_id": details.get("match_id"),
        "hero_id": player_data.get("hero_id", 0),
        "player_slot": player_data.get("player_slot", 0),
        "radiant_win": details.get("radiant_win"),
        "game_mode": details.get("game_mode"),
        "lobby_type": details.get("lobby_type"),
        "duration": details.get("duration"),
        "kills": player_data.get("kills"),
        "deaths": player_data.get("deaths"),
        "assists": player_data.get("assists"),
        "gold_per_min": player_data.get("gold_per_min"),
        "xp_per_min": player_data.get("xp_per_min"),
        "hero_damage": player_data.get("hero_damage"),
        "tower_damage": player_data.get("tower_damage"),
        "hero_healing": player_data.get("hero_healing"),
        "last_hits": player_data.get("last_hits"),
        "denies": player_data.get("denies"),
        "level": player_data.get("level"),
        "start_time": details.get("start_time"),
    }


async def sync_new_matches_from_steam(session: Session, player: Player, settings: UserSettings) -> Optional[int]:
    """
    Fast-path new-match discovery straight from Steam's own
    GetMatchHistory + GetMatchDetails — Valve's authoritative source, not
    a re-index of it, so a just-finished match can show up within
    whatever interval this is polled at (see main.py's
    steam_match_poll_loop) instead of waiting on OpenDota/Stratz to
    notice it. Requires the account to have "Expose Public Match Data"
    enabled in the Dota 2 client (unrelated to Steam profile privacy —
    see Settings page for the explainer shown to the user) and a
    steam_api_key configured.

    Returns the count of newly-stored matches, 0 if checked but nothing
    new, or None if the check couldn't be performed at all (no key, no
    account_id, or the account doesn't have public match data exposed) —
    the None/0 distinction lets the caller decide whether to still fall
    back to the regular OpenDota/Stratz sync this cycle.
    """
    if not player.account_id or not settings or not settings.steam_api_key:
        return None

    steam_client = SteamClient(settings.steam_api_key)
    history = await steam_client.get_match_history(player.account_id, matches_requested=25)
    if history is None:
        return None

    stmt = (
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.match_id.desc())
        .limit(1)
    )
    latest = session.exec(stmt).first()
    last_match_id = latest.match_id if latest else 0

    new_ids = sorted({m["match_id"] for m in history if m.get("match_id", 0) > last_match_id})
    if not new_ids:
        return 0

    new_count = 0
    for match_id in new_ids:
        if session.exec(select(Match).where(Match.match_id == match_id)).first():
            continue
        try:
            details = await steam_client.get_match_details(match_id)
        except Exception as e:
            logger.warning(f"Steam fast-path: GetMatchDetails failed for {match_id}: {e}")
            continue
        if not details:
            continue
        player_data = next((p for p in details.get("players", []) if p.get("account_id") == player.account_id), None)
        if not player_data:
            continue
        session.add(_match_row_from_dict(_steam_match_to_dict(details, player_data), player.id))
        new_count += 1

    if new_count:
        player.last_sync_at = datetime.utcnow()
        session.commit()
        logger.info(f"Steam fast-path: synced {new_count} new match(es) for player {player.account_id}")
    return new_count


# Hard cap on how many pages a single full-history backfill will fetch,
# so one very high-volume account (thousands of games) can't turn a
# one-time backfill into an unbounded fetch loop against OpenDota/Stratz
# rate limits. 60 pages x 100 = 6000 matches — generous for even a
# multi-thousand-game account; a real account exceeding this still gets
# its most recent 6000 games, not silently nothing.
_BACKFILL_MAX_PAGES = 60
_BACKFILL_PAGE_SIZE = 100


async def sync_full_match_history(
    session: Session, player: Player, settings: UserSettings, progress: list | None = None
) -> int:
    """
    One-time backfill of a player's COMPLETE match history (not just the
    newest N — see sync_player_matches's docstring for that gap), so
    "your best" per-position stats reflect the player's real full
    history rather than however many recent games happened to accumulate
    since the account was linked. Pages backward through the account's
    entire history via Stratz (skip/take) when configured, else OpenDota
    (offset/limit), storing every match not already in the DB, until a
    page comes back empty (real end of history) or _BACKFILL_MAX_PAGES is
    hit. Idempotent and safe to call more than once — every match is
    deduped by match_id the same way the incremental sync is — but is
    only meant to run once per player (see Player.history_backfilled_at,
    checked by the caller in main.py).

    Resumes from Player.history_backfill_page rather than always
    starting at page 0 - a full backfill can take a couple minutes for
    an active account, and this app got redeployed several times in
    quick succession while this was being tested, which would otherwise
    have restarted it from scratch every time and never let it finish.

    progress, if passed, gets one dict per page appended to it (page,
    source, matches, with_position, upgraded, ...) — real per-page
    diagnostic detail (which source actually produced the page's data,
    how much of it had real position) used to root-cause a real "your
    best" undercount report. That turned out to be a display cap (top-6
    "Your Best" summary), not a sync bug — 84.8% of matches already had
    real position data before any of this diagnostic tooling existed.
    Kept as an optional param (cheap, no-op unless a caller opts in)
    rather than ripped out, in case per-page detail is useful again.
    """
    if not player.account_id:
        logger.warning(f"Player {player.steam_id} has no account_id — skipping history backfill")
        return 0

    source = settings.data_source if settings else "both"
    total_new = 0
    total_upgraded = 0
    start_page = player.history_backfill_page or 0
    if start_page:
        logger.info(f"History backfill: resuming for {player.account_id} from page {start_page}")

    for page in range(start_page, _BACKFILL_MAX_PAGES):
        skip = page * _BACKFILL_PAGE_SIZE
        matches = None
        # Which source actually produced this page's data — previously
        # invisible, which is exactly the gap that made "why does Your
        # Best still undercount after a full backfill" unanswerable
        # without guessing. Logged per page below.
        page_source = None

        if source in ["stratz", "both"]:
            from services.stratz import get_stratz_client
            stratz_client = get_stratz_client(settings.stratz_api_token if settings else None)
            if stratz_client:
                try:
                    matches = await stratz_client.get_player_matches(
                        player.account_id, limit=_BACKFILL_PAGE_SIZE, skip=skip
                    )
                    if matches:
                        page_source = "stratz"
                except Exception as e:
                    logger.error(f"History backfill: Stratz page {page} failed for {player.account_id}: {e}")
                    if source == "stratz":
                        break

        if not matches and source in ["opendota", "both"]:
            client = get_opendota_client(settings.opendota_api_key if settings else None)
            try:
                matches = await client.get_player_matches(
                    player.account_id,
                    limit=_BACKFILL_PAGE_SIZE,
                    offset=skip,
                    significant=0,
                )
                if matches:
                    page_source = "opendota"
            except Exception as e:
                logger.error(f"History backfill: OpenDota page {page} failed for {player.account_id}: {e}")
                break

        if not matches:
            logger.info(f"History backfill: reached end of history for {player.account_id} at page {page}")
            break

        with_position = sum(1 for m in matches if m.get("position") is not None)

        page_new = 0
        page_upgraded = 0
        page_already_existed = 0
        page_already_had_position = 0
        page_existing_still_null = 0
        for m in matches:
            mid = m.get("match_id")
            if not mid:
                continue
            existing = session.exec(select(Match).where(Match.match_id == mid)).first()
            if existing:
                page_already_existed += 1
                # Real, confirmed bug this fixes: a match synced long ago
                # by the plain incremental loop (OpenDota's bulk match-list
                # endpoint — confirmed via a direct real call to it — never
                # includes lane_role/gpm/position at all, only Stratz's
                # equivalent bulk call does) permanently had position=None,
                # and every later sync (including this backfill) skipped it
                # outright once a row existed, so it could never benefit
                # from a real position value even after Stratz got
                # configured — the actual root cause behind "your best"
                # showing only a handful of games for a hero the player has
                # played far more (e.g. 3 shown vs. 25 real Windranger
                # games). If this fetch has real position data the stored
                # row doesn't, upgrade it in place instead of skipping.
                if existing.position is not None:
                    page_already_had_position += 1
                elif m.get("position") is not None:
                    existing.position = m["position"]
                    page_upgraded += 1
                else:
                    page_existing_still_null += 1
                continue
            session.add(_match_row_from_dict(m, player.id))
            page_new += 1

        total_new += page_new
        total_upgraded += page_upgraded
        if progress is not None:
            progress.append({
                "page": page,
                "source": page_source,
                "matches": len(matches),
                "with_position": with_position,
                "already_existed": page_already_existed,
                "already_had_position": page_already_had_position,
                "upgraded": page_upgraded,
                "still_null": page_existing_still_null,
                "new": page_new,
            })
        # Persisted after every page (not just at the very end) so a
        # redeploy mid-backfill resumes here next time instead of
        # re-fetching pages already stored — see this function's
        # docstring.
        player.history_backfill_page = page + 1
        session.commit()

        # Respect rate limits between pages — same pacing already used
        # elsewhere in this file (sync_hero_matchups/sync_hero_synergy).
        await asyncio.sleep(1.0)

        if len(matches) < _BACKFILL_PAGE_SIZE:
            # Short page — this was the last one, no need to fetch another.
            logger.info(f"History backfill: reached end of history for {player.account_id} at page {page}")
            break

    player.history_backfilled_at = datetime.utcnow()
    session.commit()
    logger.info(
        f"History backfill complete for {player.account_id}: {total_new} new matches stored, "
        f"{total_upgraded} existing matches upgraded with real position data"
    )
    return total_new


async def fetch_match_details(
    session: Session,
    match: Match,
    settings: UserSettings,
    local_parse_data: dict = None,
):
    """
    Fetch full match details from chosen data source and enrich the stored match.

    If `local_parse_data` is passed in (a caller already ran the replay through
    the local odota/parser container and aggregated the output), it is used
    directly instead of being re-derived/re-parsed here.
    """
    source = settings.data_source if settings else "both"

    od_data = None
    stratz_data = None

    if source in ["opendota", "both"]:
        client = get_opendota_client(settings.opendota_api_key if settings else None)
        try:
            od_data = await client.get_match(match.match_id)
        except Exception as e:
            logger.error(f"OpenDota failed for match {match.match_id}: {e}")
            if source == "opendota":
                return False

    # Stratz's get_match() hardcodes a fake "version" field on every response
    # (see services/stratz.py) so its own downstream OD-format merging works,
    # even when it only has a handful of sparse fields (no benchmarks, no
    # killed/life_state/lane_pos/damage — none of what the deep tabs need).
    # Capture whether OpenDota itself genuinely completed a parse *before*
    # that fake marker can get mixed in, so is_parsed never lies about it.
    od_data_genuinely_parsed = bool(od_data and od_data.get("version") is not None)

    if source in ["stratz", "both"]:
        from services.stratz import get_stratz_client
        stratz_client = get_stratz_client(settings.stratz_api_token if settings else None)
        if stratz_client:
            try:
                stratz_data = await stratz_client.get_match(match.match_id)
            except Exception as e:
                logger.error(f"Stratz failed for match {match.match_id}: {e}")
                if source == "stratz":
                    return False

    # Check if OpenDota is missing the parsed data (e.g., rate limits, missing parser output)
    needs_local_parse = local_parse_data is None
    if needs_local_parse:
        if od_data:
            # If openDota doesn't have deep parse data (no players with purchase_log)
            has_deep = any(p.get("purchase_log") for p in od_data.get("players", []))
            needs_local_parse = not has_deep
        elif stratz_data:
            needs_local_parse = True
        else:
            needs_local_parse = False

    if needs_local_parse:
        od_client_for_lookup = get_opendota_client(settings.opendota_api_key if settings else None)
        cluster, salt = await resolve_cluster_salt(
            match,
            od_client_for_lookup,
            steam_api_key=settings.steam_api_key if settings else None,
            stratz_data=stratz_data,
        )

        if cluster and salt:
            logger.info(f"OpenDota parse missing. Bypassing rate limits via local parser for {match.match_id}")
            local_parse_data = await parse_match_locally(match.match_id, cluster, salt)

            if local_parse_data:
                # /blob discards hero position data (odota/parser's own
                # CreateParsedDataBlob.java: `case "interval": break;`), so
                # get it separately from the raw event stream, which emits a
                # real x/y per hero every game-second — see position_parser.py.
                try:
                    positions = await parse_hero_positions(match.match_id, cluster, salt)
                    if positions:
                        for p_local in local_parse_data.get("players", []):
                            pos_data = positions.get(p_local.get("player_slot"))
                            if pos_data:
                                p_local["pos_t"] = pos_data
                except Exception as e:
                    logger.warning(f"[{match.match_id}] Position parse failed (non-fatal): {e}")
        else:
            logger.warning(f"[{match.match_id}] Could not resolve cluster/replay_salt — cannot local-parse")

    # Hero position data (pos_t) only ever comes from our own local parser —
    # OpenDota's API never provides it. So even when OD's own official parse
    # already has everything else we need (purchase_log etc, meaning
    # needs_local_parse was False above and we skipped local parsing
    # entirely), still make sure positions get fetched at least once.
    already_has_positions = False
    if match.all_players:
        try:
            already_has_positions = any(p.get("pos_t") for p in json.loads(match.all_players))
        except (json.JSONDecodeError, TypeError):
            pass
    local_parse_has_positions = local_parse_data and any(p.get("pos_t") for p in local_parse_data.get("players", []))

    # Only bother when we have real od_data to merge positions into — if
    # od_data is missing, a positions-only stub could otherwise become the
    # *primary* data source below (data = local_parse_data fallback), losing
    # everything else instead of just adding to it.
    if od_data and not already_has_positions and not local_parse_has_positions:
        od_client_for_positions = get_opendota_client(settings.opendota_api_key if settings else None)
        pos_cluster, pos_salt = await resolve_cluster_salt(
            match,
            od_client_for_positions,
            steam_api_key=settings.steam_api_key if settings else None,
            stratz_data=stratz_data,
        )
        if pos_cluster and pos_salt:
            try:
                positions = await parse_hero_positions(match.match_id, pos_cluster, pos_salt)
                if positions:
                    if not local_parse_data:
                        local_parse_data = {"players": []}
                    for player_slot, pos_data in positions.items():
                        p_local = next((p for p in local_parse_data["players"] if p.get("player_slot") == player_slot), None)
                        if p_local:
                            p_local["pos_t"] = pos_data
                        else:
                            local_parse_data["players"].append({"player_slot": player_slot, "pos_t": pos_data})
            except Exception as e:
                logger.warning(f"[{match.match_id}] Position parse failed (non-fatal): {e}")

    if local_parse_data:
        # Add the derived stats OpenDota's own backend computes from raw parser
        # output (hero_kills/tower_kills/etc from `killed`, buyback_count,
        # lane_efficiency_pct, lane, ...) — see replay_compute.py.
        duration = (od_data or {}).get("duration") or match.duration
        radiant_win = (od_data or {}).get("radiant_win")
        if radiant_win is None:
            radiant_win = match.radiant_win
        apply_computed_fields(local_parse_data.get("players", []), duration=duration, radiant_win=radiant_win)

    # Choose the primary data source (prefer OpenDota for deep stats, fallback to local parse, then stratz)
    if local_parse_data and od_data:
        # Merge every raw+computed field the local parse has into od_data,
        # preserving od_data's own identity/benchmark/name fields (the local
        # parser never has those). A full merge — rather than a hand-picked
        # whitelist — is what actually gets every tab's data populated,
        # since each tab reads a different subset of the ~50 raw parser
        # fields and any one left off the list silently shows blank.
        for p_od in od_data.get("players", []):
            p_local = next((p for p in local_parse_data.get("players", []) if p.get("player_slot") == p_od.get("player_slot")), None)
            if p_local:
                for key, value in p_local.items():
                    if value is not None:
                        p_od[key] = value

        for key, value in local_parse_data.items():
            if key != "players" and value is not None:
                od_data[key] = value
        data = od_data
    else:
        data = od_data if od_data else (local_parse_data if local_parse_data else stratz_data)

    if not data:
        return False
        
    # If we have both, we can merge Stratz high-fidelity coordinates into the primary data
    if data and stratz_data:
        for p_od in data.get("players", []):
            p_stratz = next((p for p in stratz_data.get("players", []) if p.get("account_id") == p_od.get("account_id")), None)
            if p_stratz:
                # Augment OpenDota with Stratz high-fidelity coordinates
                if not p_od.get("kills_log") and p_stratz.get("kills_log"):
                    p_od["kills_log"] = p_stratz["kills_log"]
                if not p_od.get("purchase_log") and p_stratz.get("purchase_log"):
                    p_od["purchase_log"] = p_stratz["purchase_log"]

    # Find our player in the match
    player_data = None
    for p in data.get("players", []):
        if p.get("player_slot") == match.player_slot:
            player_data = p
            break
        # Fallback: match by hero
        if p.get("hero_id") == match.hero_id:
            player_data = p

    if not player_data:
        logger.warning(f"Could not find player data in match {match.match_id}")
        return False

    # Update match with detailed data
    match.opendota_raw = json.dumps(data)
    match.gold_t = json.dumps(player_data.get("gold_t")) if player_data.get("gold_t") else None
    match.xp_t = json.dumps(player_data.get("xp_t")) if player_data.get("xp_t") else None
    match.lh_t = json.dumps(player_data.get("lh_t")) if player_data.get("lh_t") else None
    match.dn_t = json.dumps(player_data.get("dn_t")) if player_data.get("dn_t") else None
    match.benchmarks = json.dumps(player_data.get("benchmarks")) if player_data.get("benchmarks") else None
    match.purchase_log = json.dumps(player_data.get("purchase_log")) if player_data.get("purchase_log") else None
    match.kills_log = json.dumps(player_data.get("kills_log")) if player_data.get("kills_log") else None
    match.runes_log = json.dumps(player_data.get("runes_log")) if player_data.get("runes_log") else None
    match.obs_log = json.dumps(player_data.get("obs_log")) if player_data.get("obs_log") else None
    match.sen_log = json.dumps(player_data.get("sen_log")) if player_data.get("sen_log") else None
    match.teamfights = json.dumps(data.get("teamfights")) if data.get("teamfights") else None
    match.objectives = json.dumps(data.get("objectives")) if data.get("objectives") else None
    match.radiant_gold_adv = json.dumps(data.get("radiant_gold_adv")) if data.get("radiant_gold_adv") else None
    match.radiant_xp_adv = json.dumps(data.get("radiant_xp_adv")) if data.get("radiant_xp_adv") else None
    match.chat = json.dumps(data.get("chat")) if data.get("chat") else None
    # OpenDota's real field for draft picks/bans is "picks_bans"
    # ({is_pick, hero_id, team, order} — team 0=Radiant, 1=Dire), not
    # "draft_timings" (which doesn't exist in any of our data sources —
    # confirmed against odota_core's own schema and sample responses).
    match.draft_timings = json.dumps(data.get("picks_bans")) if data.get("picks_bans") else None

    # Item slots
    items = [player_data.get(f"item_{i}") for i in range(6)]
    match.items = json.dumps(items)
    backpack = [player_data.get(f"backpack_{i}") for i in range(3)]
    match.backpack = json.dumps(backpack)
    match.neutral_item = player_data.get("item_neutral")

    # All 10 players - comprehensive data for all tabs
    all_players = []
    for p in data.get("players", []):
        p_copy = p.copy()
        p_copy["persona"] = p.get("personaname", "")
        p_copy["items"] = [p.get(f"item_{i}") for i in range(6)]
        p_copy["backpack"] = [p.get(f"backpack_{i}") for i in range(3)]
        all_players.append(p_copy)
    match.all_players = json.dumps(all_players)

    # Only ever true from a genuine parse — our own local odota/parser run, or
    # OpenDota's own official job actually completing. Never from Stratz's
    # synthetic "version" marker, and never just because *some* data exists.
    match.is_parsed = (local_parse_data is not None) or od_data_genuinely_parsed
    match.rank_tier = player_data.get("rank_tier")
    session.commit()

    return True


async def analyze_and_store(session: Session, match: Match, player: Player):
    """Run analysis engine on a match and store results."""
    if match.is_analyzed:
        return

    # Build player_data dict from match record
    player_data = {
        "hero_id": match.hero_id,
        "kills": match.kills,
        "deaths": match.deaths,
        "assists": match.assists,
        "gold_per_min": match.gpm,
        "xp_per_min": match.xpm,
        "hero_damage": match.hero_damage,
        "tower_damage": match.tower_damage,
        "hero_healing": match.hero_healing,
        "last_hits": match.last_hits,
        "denies": match.denies,
        "level": match.level,
        "lane": match.lane,
        "lane_role": match.lane_role,
        "player_slot": match.player_slot,
        "lh_t": match.lh_t,
        "gold_t": match.gold_t,
        "obs_log": json.loads(match.obs_log) if match.obs_log else [],
        "sen_log": json.loads(match.sen_log) if match.sen_log else [],
    }
    match_data = {
        "duration": match.duration,
    }

    rank_tier = match.rank_tier or player.rank_tier or 0
    result = analyze_match(match_data, player_data, rank_tier)

    analysis = MatchAnalysis(
        match_id=match.match_id,
        player_id=player.id,
        laning_score=result["laning_score"],
        cs_at_10=result["cs_at_10"],
        cs_benchmark_rank=result["cs_benchmark_rank"],
        lane_kills=result["lane_kills"],
        lane_deaths=result["lane_deaths"],
        performance_score=result["performance_score"],
        farming_score=result["farming_score"],
        fighting_score=result["fighting_score"],
        vision_score=result["vision_score"],
        objective_score=result["objective_score"],
        death_score=result["death_score"],
        rank_comparison=json.dumps(result["rank_comparison"]),
        action_items=json.dumps(result["action_items"]),
        mistakes=json.dumps(result["mistakes"]),
        laning_analysis=json.dumps(result["laning_analysis"]),
        midgame_analysis=json.dumps(result["midgame_analysis"]),
        lategame_analysis=json.dumps(result["lategame_analysis"]),
    )
    session.add(analysis)
    match.is_analyzed = True
    session.commit()


async def create_progress_snapshot(session: Session, player: Player):
    """Create a daily progress snapshot from recent matches."""
    today = date.today().isoformat()

    # Check if we already have today's snapshot
    existing = session.exec(
        select(ProgressSnapshot)
        .where(ProgressSnapshot.player_id == player.id)
        .where(ProgressSnapshot.snapshot_date == today)
    ).first()
    if existing:
        return

    # Get matches from today
    recent = session.exec(
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.played_at.desc())
        .limit(20)
    ).all()

    if not recent:
        return

    wins = sum(1 for m in recent if m.result == "win")
    total = len(recent)

    avg_kda = sum(
        ((m.kills or 0) + (m.assists or 0)) / max(m.deaths or 1, 1) for m in recent
    ) / max(total, 1)

    avg_gpm = sum(m.gpm or 0 for m in recent) / max(total, 1)
    avg_xpm = sum(m.xpm or 0 for m in recent) / max(total, 1)
    avg_deaths = sum(m.deaths or 0 for m in recent) / max(total, 1)
    avg_hero_damage = sum(m.hero_damage or 0 for m in recent) / max(total, 1)
    avg_tower_damage = sum(m.tower_damage or 0 for m in recent) / max(total, 1)
    avg_cs_min = sum(
        (m.last_hits or 0) / max((m.duration or 1) / 60, 1) for m in recent
    ) / max(total, 1)

    snapshot = ProgressSnapshot(
        player_id=player.id,
        snapshot_date=today,
        period_type="daily",
        matches_played=total,
        wins=wins,
        avg_kda=round(avg_kda, 2),
        avg_gpm=round(avg_gpm, 0),
        avg_xpm=round(avg_xpm, 0),
        avg_cs_min=round(avg_cs_min, 1),
        avg_deaths=round(avg_deaths, 1),
        avg_hero_damage=round(avg_hero_damage, 0),
        avg_tower_damage=round(avg_tower_damage, 0),
        mmr_estimate=player.mmr_estimate,
        rank_tier=player.rank_tier,
    )
    session.add(snapshot)
    session.commit()
    logger.info(f"Created progress snapshot for player {player.account_id} — {today}")


async def sync_hero_meta(session: Session, settings: UserSettings) -> int:
    """Fetch and cache hero meta data from OpenDota. Returns the number
    of hero/bracket rows written, or raises on failure (rather than
    swallowing it into a silent None) so callers — in particular the
    manual "Refresh Meta Data" button's endpoint — can tell success from
    failure instead of both looking identical."""
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    hero_stats = await client.get_hero_stats()

    count = 0
    for hero in hero_stats:
        hero_id = hero.get("id")
        if not hero_id:
            continue

        # Aggregate across all brackets
        for bracket_key in range(1, 9):
            pick_key = f"{bracket_key}_pick"
            win_key = f"{bracket_key}_win"
            picks = hero.get(pick_key, 0)
            wins = hero.get(win_key, 0)

            if not picks:
                continue

            existing = session.exec(
                select(HeroMeta)
                .where(HeroMeta.hero_id == hero_id)
                .where(HeroMeta.rank_bracket == bracket_key)
            ).first()

            if existing:
                existing.pick_count = picks
                existing.win_count = wins
                existing.winrate = wins / max(picks, 1)
                existing.updated_at = datetime.utcnow()
            else:
                meta = HeroMeta(
                    hero_id=hero_id,
                    rank_bracket=bracket_key,
                    pick_count=picks,
                    win_count=wins,
                    winrate=wins / max(picks, 1),
                    updated_at=datetime.utcnow(),
                )
                session.add(meta)
            count += 1

    session.commit()
    logger.info(f"Hero meta data synced from OpenDota ({count} hero/bracket rows)")
    return count


async def sync_hero_matchups(session: Session, settings: UserSettings) -> int:
    """
    Fetch hero matchup data from OpenDota, 30 heroes per call (rate-limit
    friendly). Previously always processed the same first 30 heroes in
    HEROES — meaning the other ~95 heroes were never synced no matter how
    often this ran. Now picks whichever heroes have gone longest without
    an update (or were never synced at all), so repeated calls naturally
    rotate through the full hero list over time, self-healing if any
    individual hero's fetch fails (it just stays "oldest" and gets
    retried next cycle) — no separate cursor/offset field needed.

    Returns the number of matchup rows written this call.
    """
    client = get_opendota_client(settings.opendota_api_key if settings else None)
    total_rows = 0

    last_synced = dict(
        session.exec(
            select(HeroMatchup.hero_id, func.max(HeroMatchup.updated_at))
            .group_by(HeroMatchup.hero_id)
        ).all()
    )
    all_hero_ids = list(HEROES.keys())
    # Heroes never synced at all sort first (None treated as oldest),
    # then whichever real timestamp is furthest in the past.
    stale_first = sorted(all_hero_ids, key=lambda hid: last_synced.get(hid) or datetime.min)

    for hero_id in stale_first[:30]:
        try:
            matchups = await client.get_hero_matchups(hero_id)
        except Exception:
            continue

        for mu in matchups:
            enemy_id = mu.get("hero_id")
            if not enemy_id:
                continue

            games = mu.get("games_played", 0)
            wins = mu.get("wins", 0)
            advantage = ((wins / max(games, 1)) - 0.5) * 100 if games > 0 else 0

            existing = session.exec(
                select(HeroMatchup)
                .where(HeroMatchup.hero_id == hero_id)
                .where(HeroMatchup.enemy_hero_id == enemy_id)
            ).first()

            if existing:
                existing.games_played = games
                existing.wins = wins
                existing.advantage = round(advantage, 2)
                existing.updated_at = datetime.utcnow()
            else:
                session.add(HeroMatchup(
                    hero_id=hero_id,
                    enemy_hero_id=enemy_id,
                    games_played=games,
                    wins=wins,
                    advantage=round(advantage, 2),
                    updated_at=datetime.utcnow(),
                ))
            total_rows += 1

        await asyncio.sleep(1.5)  # Respect rate limits

    session.commit()
    logger.info(f"Hero matchup data synced ({total_rows} rows across {len(stale_first[:30])} heroes)")
    return total_rows


async def sync_hero_synergy(session: Session, settings: UserSettings) -> int:
    """
    Real ally-pair synergy data from Stratz's public API (see
    services/stratz.py's get_hero_synergy_and_matchups) — the "who wins
    more often WITH this hero" data that OpenDota's API doesn't actually
    provide (confirmed directly against OpenDota's own responses earlier
    in this project). Requires a Stratz API token in settings; returns 0
    (not an error — this is an optional enhancement) if none is set.

    Same staleness-rotation pattern as sync_hero_matchups: 30 heroes per
    call, whichever have gone longest without a sync, self-healing if
    any individual hero's fetch fails.
    """
    if not settings or not getattr(settings, "stratz_api_token", None):
        return 0

    from services.stratz import get_stratz_client, rank_bracket_to_stratz
    stratz_client = get_stratz_client(settings.stratz_api_token)

    last_synced = dict(
        session.exec(
            select(HeroSynergy.hero_id, func.max(HeroSynergy.updated_at))
            .group_by(HeroSynergy.hero_id)
        ).all()
    )
    from utils.dota_constants import HEROES
    all_hero_ids = list(HEROES.keys())
    stale_first = sorted(all_hero_ids, key=lambda hid: last_synced.get(hid) or datetime.min)

    total_rows = 0
    for hero_id in stale_first[:30]:
        try:
            result = await stratz_client.get_hero_synergy_and_matchups(hero_id, rank_bracket_to_stratz(None))
        except Exception as e:
            logger.warning(f"Stratz synergy fetch failed for hero {hero_id}: {e}")
            continue

        now = datetime.utcnow()
        for ally in result.get("with", []):
            existing = session.exec(
                select(HeroSynergy)
                .where(HeroSynergy.hero_id == hero_id)
                .where(HeroSynergy.ally_hero_id == ally["hero_id"])
            ).first()
            if existing:
                existing.matches = ally["matches"]
                existing.synergy = ally["synergy"]
                existing.winrate_together = ally["winrate"]
                existing.updated_at = now
            else:
                session.add(HeroSynergy(
                    hero_id=hero_id,
                    ally_hero_id=ally["hero_id"],
                    matches=ally["matches"],
                    synergy=ally["synergy"],
                    winrate_together=ally["winrate"],
                    updated_at=now,
                ))
            total_rows += 1

        await asyncio.sleep(1.0)

    session.commit()
    logger.info(f"Hero synergy data synced from Stratz ({total_rows} rows across {len(stale_first[:30])} heroes)")
    return total_rows


# Import here to avoid circular dependency
from utils.dota_constants import HEROES
