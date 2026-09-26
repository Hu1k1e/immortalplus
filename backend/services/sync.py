"""
Background sync service.
Handles periodic data fetching from APIs, progress snapshot creation,
and match history synchronization.
"""

import asyncio
import json
import logging
from datetime import datetime, date

from sqlalchemy.orm import Session
from sqlmodel import select

from models import (
    Match, Player, ProgressSnapshot, HeroMeta, HeroMatchup, UserSettings,
)
from services.opendota import get_opendota_client
from services.analysis_engine import analyze_match
from services.local_parser import parse_match_locally
from services.steam import resolve_cluster_salt
from services.replay_compute import apply_computed_fields
from models import MatchAnalysis

logger = logging.getLogger(__name__)


async def sync_player_matches(session: Session, player: Player, settings: UserSettings):
    """
    Fetch new matches from OpenDota and store them in the database.
    Only fetches matches newer than the last synced match.
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

        # Determine win/loss
        player_slot = m.get("player_slot", 0)
        radiant_win = m.get("radiant_win")
        is_radiant = player_slot < 128
        result = None
        if radiant_win is not None:
            result = "win" if (is_radiant == radiant_win) else "loss"

        match = Match(
            match_id=mid,
            player_id=player.id,
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
            party_size=m.get("party_size"),
            player_slot=player_slot,
            radiant_win=radiant_win,
            avg_rank_tier=m.get("average_rank"),
            played_at=datetime.utcfromtimestamp(m["start_time"]) if m.get("start_time") else None,
        )
        session.add(match)
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
        else:
            logger.warning(f"[{match.match_id}] Could not resolve cluster/replay_salt — cannot local-parse")

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
    match.draft_timings = json.dumps(data.get("draft_timings")) if data.get("draft_timings") else None

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


async def sync_hero_meta(session: Session, settings: UserSettings):
    """Fetch and cache hero meta data from OpenDota."""
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    try:
        hero_stats = await client.get_hero_stats()
    except Exception as e:
        logger.error(f"Failed to fetch hero stats: {e}")
        return

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

    session.commit()
    logger.info("Hero meta data synced from OpenDota")


async def sync_hero_matchups(session: Session, settings: UserSettings):
    """Fetch hero matchup data from OpenDota for all heroes."""
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    for hero_id in list(HEROES.keys())[:30]:  # Rate-limit: do 30 heroes per sync
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

        await asyncio.sleep(1.5)  # Respect rate limits

    session.commit()
    logger.info("Hero matchup data synced")


# Import here to avoid circular dependency
from utils.dota_constants import HEROES
