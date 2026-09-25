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


async def fetch_match_details(session: Session, match: Match, settings: UserSettings):
    """
    Fetch full match details from chosen data source and enrich the stored match.
    """
    source = settings.data_source if settings else "both"
    
    data = None
    if source in ["stratz", "both"]:
        from services.stratz import get_stratz_client
        stratz_client = get_stratz_client(settings.stratz_api_token if settings else None)
        if stratz_client:
            try:
                data = await stratz_client.get_match(match.match_id)
            except Exception as e:
                logger.error(f"Stratz failed for match {match.match_id}: {e}")
                if source == "stratz":
                    return False
        
    if not data and source in ["opendota", "both"]:
        client = get_opendota_client(settings.opendota_api_key if settings else None)
        try:
            data = await client.get_match(match.match_id)
        except Exception as e:
            logger.error(f"OpenDota failed for match {match.match_id}: {e}")
            return False

    if not data:
        return False

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
        all_players.append({
            "hero_id": p.get("hero_id"),
            "player_slot": p.get("player_slot"),
            "account_id": p.get("account_id"),
            "kills": p.get("kills"),
            "deaths": p.get("deaths"),
            "assists": p.get("assists"),
            "gpm": p.get("gold_per_min"),
            "xpm": p.get("xp_per_min"),
            "hero_damage": p.get("hero_damage"),
            "tower_damage": p.get("tower_damage"),
            "hero_healing": p.get("hero_healing"),
            "last_hits": p.get("last_hits"),
            "denies": p.get("denies"),
            "level": p.get("level"),
            "items": [p.get(f"item_{i}") for i in range(6)],
            "backpack": [p.get(f"backpack_{i}") for i in range(3)],
            "neutral_item": p.get("item_neutral"),
            "persona": p.get("personaname", ""),
            "obs_placed": p.get("obs_placed", 0),
            "sen_placed": p.get("sen_placed", 0),
            "net_worth": p.get("net_worth", 0),
            "rank_tier": p.get("rank_tier"),
            # Time series for graphs
            "gold_t": p.get("gold_t"),
            "xp_t": p.get("xp_t"),
            "lh_t": p.get("lh_t"),
            "dn_t": p.get("dn_t"),
            # Logs for detailed tabs
            "obs_log": p.get("obs_log", []),
            "sen_log": p.get("sen_log", []),
            "kills_log": p.get("kills_log", []),
            "purchase_log": p.get("purchase_log", []),
            "runes_log": p.get("runes_log", []),
            # Laning tab data
            "lane": p.get("lane"),
            "lane_role": p.get("lane_role"),
            "lane_efficiency_pct": p.get("lane_efficiency_pct"),
            "is_roaming": p.get("is_roaming"),
            "pos": p.get("pos", {}),

            # Casts / Farm tab data
            "ability_uses": p.get("ability_uses", {}),
            "item_uses": p.get("item_uses", {}),
            "gold_reasons": p.get("gold_reasons", {}),
            "xp_reasons": p.get("xp_reasons", {}),
            # Benchmarks tab
            # Performance tab
            "multi_kills": p.get("multi_kills"),
            "kill_streaks": p.get("kill_streaks"),
            "stuns": p.get("stuns"),
            "creeps_stacked": p.get("creeps_stacked"),
            "camps_stacked": p.get("camps_stacked"),
            "rune_pickups": p.get("rune_pickups"),
            "firstblood_claimed": p.get("firstblood_claimed"),
            "teamfight_participation": p.get("teamfight_participation"),
            "towers_killed": p.get("towers_killed"),
            "roshans_killed": p.get("roshans_killed"),
            "max_hero_hit": p.get("max_hero_hit"),
            "buyback_count": p.get("buyback_count"),
            "pings": p.get("pings"),
            "actions_per_min": p.get("actions_per_min"),
            # Combat tab data
            "damage_targets": p.get("damage_targets"),
            "damage_inflictor": p.get("damage_inflictor"),
            "damage_inflictor_received": p.get("damage_inflictor_received"),
            # Farm tab
            "gold_reasons": p.get("gold_reasons"),
            "xp_reasons": p.get("xp_reasons"),
            # Casts tab
            "ability_uses": p.get("ability_uses"),
            "ability_targets": p.get("ability_targets"),
            "item_uses": p.get("item_uses"),
            # Vision tab
            "obs_left_log": p.get("obs_left_log", []),
            "sen_left_log": p.get("sen_left_log", []),
            # Actions tab
            "life_state": p.get("life_state"),
            "life_state_dead": p.get("life_state_dead"),
            # Cosmetics
            "cosmetics": p.get("cosmetics"),
        })
    match.all_players = json.dumps(all_players)

    match.is_parsed = data.get("version") is not None
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
