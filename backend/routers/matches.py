"""
Match history and match detail endpoints.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Match, Player, UserSettings, MatchAnalysis
from services.opendota import get_opendota_client
from services.sync import sync_player_matches, fetch_match_details, analyze_and_store
from services.analysis_engine import get_hero_name, _classify_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/matches", tags=["matches"])


def _parse_json_field(value):
    """Safely parse a JSON string field."""
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def _match_to_dict(m: Match) -> dict:
    """Convert a Match model to API response dict."""
    return {
        "match_id": m.match_id,
        "hero_id": m.hero_id,
        "result": m.result,
        "game_mode": m.game_mode,
        "lobby_type": m.lobby_type,
        "duration": m.duration,
        "kills": m.kills,
        "deaths": m.deaths,
        "assists": m.assists,
        "gpm": m.gpm,
        "xpm": m.xpm,
        "hero_damage": m.hero_damage,
        "tower_damage": m.tower_damage,
        "hero_healing": m.hero_healing,
        "last_hits": m.last_hits,
        "denies": m.denies,
        "level": m.level,
        "lane": m.lane,
        "lane_role": m.lane_role,
        "items": _parse_json_field(m.items),
        "neutral_item": m.neutral_item,
        "party_size": m.party_size,
        "is_parsed": m.is_parsed,
        "is_analyzed": m.is_analyzed,
        "rank_tier": m.rank_tier,
        "avg_rank_tier": m.avg_rank_tier,
        "player_slot": m.player_slot,
        "radiant_win": m.radiant_win,
        "played_at": m.played_at.isoformat() if m.played_at else None,
    }


@router.get("")
async def get_matches(
    limit: int = Query(50, le=200),
    offset: int = 0,
    hero_id: int = None,
    result: str = None,
    game_mode: int = None,
    session: Session = Depends(get_session),
):
    """Get match history from local database."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    query = select(Match).where(Match.player_id == player.id)

    if hero_id:
        query = query.where(Match.hero_id == hero_id)
    if result:
        query = query.where(Match.result == result)
    if game_mode is not None:
        query = query.where(Match.game_mode == game_mode)

    query = query.order_by(Match.match_id.desc()).offset(offset).limit(limit)
    matches = session.exec(query).all()

    # Total count for pagination
    count_query = select(Match).where(Match.player_id == player.id)
    if hero_id:
        count_query = count_query.where(Match.hero_id == hero_id)
    if result:
        count_query = count_query.where(Match.result == result)

    total = len(session.exec(count_query).all())

    return {
        "matches": [_match_to_dict(m) for m in matches],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.post("/sync")
async def sync_matches(session: Session = Depends(get_session)):
    """Fetch new matches from OpenDota and store them."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    settings = session.exec(select(UserSettings)).first()
    count = await sync_player_matches(session, player, settings)

    return {"synced": count, "status": "done"}


@router.get("/{match_id}")
async def get_match_detail(match_id: int, session: Session = Depends(get_session)):
    """Get detailed data for a specific match."""
    match = session.exec(select(Match).where(Match.match_id == match_id)).first()

    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    settings = session.exec(select(UserSettings)).first()

    # If we don't have it locally, or it lacks details, fetch from OpenDota
    if not match or not match.gold_t:
        if not match:
            # Create a stub match entry
            if not player:
                raise HTTPException(status_code=404, detail="No player profile found")

            client = get_opendota_client(settings.opendota_api_key if settings else None)
            try:
                data = await client.get_match(match_id)
            except Exception as e:
                raise HTTPException(status_code=502, detail=str(e))

            # Find our player
            player_data = None
            for p in data.get("players", []):
                if p.get("account_id") == player.account_id:
                    player_data = p
                    break

            if not player_data:
                # Return raw OpenDota data if player not found
                return {"source": "opendota", "data": data}

            ps = player_data.get("player_slot", 0)
            rw = data.get("radiant_win")
            is_rad = ps < 128
            result = "win" if (is_rad == rw) else "loss" if rw is not None else None

            from datetime import datetime
            match = Match(
                match_id=match_id,
                player_id=player.id,
                hero_id=player_data.get("hero_id", 0),
                result=result,
                game_mode=data.get("game_mode"),
                lobby_type=data.get("lobby_type"),
                duration=data.get("duration"),
                kills=player_data.get("kills"),
                deaths=player_data.get("deaths"),
                assists=player_data.get("assists"),
                gpm=player_data.get("gold_per_min"),
                xpm=player_data.get("xp_per_min"),
                hero_damage=player_data.get("hero_damage"),
                tower_damage=player_data.get("tower_damage"),
                hero_healing=player_data.get("hero_healing"),
                last_hits=player_data.get("last_hits"),
                denies=player_data.get("denies"),
                level=player_data.get("level"),
                lane=player_data.get("lane"),
                lane_role=player_data.get("lane_role"),
                player_slot=ps,
                radiant_win=rw,
                played_at=datetime.utcfromtimestamp(data["start_time"]) if data.get("start_time") else None,
            )
            session.add(match)
            session.commit()

        await fetch_match_details(session, match, settings)
        session.refresh(match)

    response = _match_to_dict(match)
    response["gold_t"] = _parse_json_field(match.gold_t)
    response["xp_t"] = _parse_json_field(match.xp_t)
    response["lh_t"] = _parse_json_field(match.lh_t)
    response["dn_t"] = _parse_json_field(match.dn_t)
    response["benchmarks"] = _parse_json_field(match.benchmarks)
    response["purchase_log"] = _parse_json_field(match.purchase_log)
    response["kills_log"] = _parse_json_field(match.kills_log)
    response["obs_log"] = _parse_json_field(match.obs_log)
    response["sen_log"] = _parse_json_field(match.sen_log)
    response["teamfights"] = _parse_json_field(match.teamfights)
    response["objectives"] = _parse_json_field(match.objectives)
    response["all_players"] = _parse_json_field(match.all_players)

    return response


@router.get("/{match_id}/analysis")
async def get_match_analysis(match_id: int, session: Session = Depends(get_session)):
    """Get or generate analysis for a specific match."""
    match = session.exec(select(Match).where(Match.match_id == match_id)).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    settings = session.exec(select(UserSettings)).first()

    # Ensure we have details
    if not match.gold_t:
        await fetch_match_details(session, match, settings)
        session.refresh(match)

    # Check for existing analysis
    analysis = session.exec(
        select(MatchAnalysis).where(MatchAnalysis.match_id == match_id)
    ).first()

    if not analysis:
        # Generate analysis
        await analyze_and_store(session, match, player)
        analysis = session.exec(
            select(MatchAnalysis).where(MatchAnalysis.match_id == match_id)
        ).first()

    if not analysis:
        raise HTTPException(status_code=500, detail="Failed to generate analysis")

    return {
        "match_id": match_id,
        "performance_score": analysis.performance_score,
        "laning_score": analysis.laning_score,
        "farming_score": analysis.farming_score,
        "fighting_score": analysis.fighting_score,
        "vision_score": analysis.vision_score,
        "objective_score": analysis.objective_score,
        "death_score": analysis.death_score,
        "cs_at_10": analysis.cs_at_10,
        "cs_benchmark_rank": analysis.cs_benchmark_rank,
        "rank_comparison": _parse_json_field(analysis.rank_comparison),
        "mistakes": _parse_json_field(analysis.mistakes),
        "action_items": _parse_json_field(analysis.action_items),
        "laning_analysis": _parse_json_field(analysis.laning_analysis),
        "midgame_analysis": _parse_json_field(analysis.midgame_analysis),
        "lategame_analysis": _parse_json_field(analysis.lategame_analysis),
        "ai_coaching": _parse_json_field(analysis.ai_coaching),
        "analyzed_at": analysis.analyzed_at.isoformat() if analysis.analyzed_at else None,
    }


@router.post("/{match_id}/request-parse")
async def request_parse(match_id: int, session: Session = Depends(get_session)):
    """Request OpenDota to parse a match replay."""
    settings = session.exec(select(UserSettings)).first()
    client = get_opendota_client(settings.opendota_api_key if settings else None)

    try:
        result = await client.request_parse(match_id)
        return {"status": "parse_requested", "job": result}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/{match_id}/coach")
async def get_ai_coaching(match_id: int, session: Session = Depends(get_session)):
    """Generate AI coaching feedback for a specific match using configured LLM."""
    match = session.exec(select(Match).where(Match.match_id == match_id)).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    settings = session.exec(select(UserSettings)).first()
    if not settings or not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured in Settings.")

    analysis = session.exec(
        select(MatchAnalysis).where(MatchAnalysis.match_id == match_id)
    ).first()

    if not analysis:
        # Generate analysis first if not exists
        player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
        if not match.gold_t:
            await fetch_match_details(session, match, settings)
            session.refresh(match)
        await analyze_and_store(session, match, player)
        analysis = session.exec(
            select(MatchAnalysis).where(MatchAnalysis.match_id == match_id)
        ).first()

    if not analysis:
        raise HTTPException(status_code=500, detail="Failed to generate match analysis.")

    # Return cached coaching if exists
    if analysis.ai_coaching:
        return _parse_json_field(analysis.ai_coaching)

    # Get match data
    match_data = {
        "duration": match.duration,
        "kills": match.kills,
        "deaths": match.deaths,
        "assists": match.assists,
        "purchase_log": _parse_json_field(match.purchase_log),
        "kills_log": _parse_json_field(match.kills_log)
    }
    
    # Get analysis result dict
    analysis_result = {
        "hero_name": get_hero_name(match.hero_id),
        "role": _classify_role(match.lane, match.lane_role, match.hero_id),
        "cs_at_10": analysis.cs_at_10,
        "rank_comparison": _parse_json_field(analysis.rank_comparison),
        "laning_analysis": _parse_json_field(analysis.laning_analysis),
        "midgame_analysis": _parse_json_field(analysis.midgame_analysis),
        "lategame_analysis": _parse_json_field(analysis.lategame_analysis),
    }

    from services.ai_coach import generate_ai_coaching
    coaching_feedback = await generate_ai_coaching(match_data, analysis_result, settings)

    if not coaching_feedback:
        raise HTTPException(status_code=500, detail="Failed to generate AI coaching feedback.")

    # Save to database
    analysis.ai_coaching = json.dumps(coaching_feedback)
    session.add(analysis)
    session.commit()

    return coaching_feedback

