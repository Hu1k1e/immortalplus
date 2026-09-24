"""
Progress tracking and improvement analytics endpoints.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Match, Player, ProgressSnapshot, MatchAnalysis, ActionItem
from services.sync import create_progress_snapshot

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/snapshots")
async def get_snapshots(
    limit: int = Query(90, le=365),
    period: str = Query("daily"),
    session: Session = Depends(get_session),
):
    """Get progress snapshots over time."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    snapshots = session.exec(
        select(ProgressSnapshot)
        .where(ProgressSnapshot.player_id == player.id)
        .where(ProgressSnapshot.period_type == period)
        .order_by(ProgressSnapshot.snapshot_date.desc())
        .limit(limit)
    ).all()

    return [
        {
            "date": s.snapshot_date,
            "matches_played": s.matches_played,
            "wins": s.wins,
            "winrate": round(s.wins / max(s.matches_played, 1) * 100, 1),
            "avg_kda": s.avg_kda,
            "avg_gpm": s.avg_gpm,
            "avg_xpm": s.avg_xpm,
            "avg_cs_min": s.avg_cs_min,
            "avg_deaths": s.avg_deaths,
            "avg_hero_damage": s.avg_hero_damage,
            "avg_tower_damage": s.avg_tower_damage,
            "mmr_estimate": s.mmr_estimate,
            "rank_tier": s.rank_tier,
            "improvement_score": s.improvement_score,
        }
        for s in reversed(snapshots)
    ]


@router.get("/trends")
async def get_trends(
    window: int = Query(20, description="Rolling window size"),
    stat: str = Query("kda", description="Stat to track"),
    session: Session = Depends(get_session),
):
    """Get rolling trend data for a specific stat over recent matches."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    matches = session.exec(
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.played_at.desc())
        .limit(window * 3)  # Get extra for rolling calculation
    ).all()

    matches = list(reversed(matches))  # Chronological order

    stat_map = {
        "kda": lambda m: ((m.kills or 0) + (m.assists or 0)) / max(m.deaths or 1, 1),
        "gpm": lambda m: m.gpm or 0,
        "xpm": lambda m: m.xpm or 0,
        "cs_min": lambda m: (m.last_hits or 0) / max((m.duration or 1) / 60, 1),
        "deaths": lambda m: m.deaths or 0,
        "hero_damage": lambda m: m.hero_damage or 0,
        "tower_damage": lambda m: m.tower_damage or 0,
        "winrate": lambda m: 1 if m.result == "win" else 0,
    }

    extractor = stat_map.get(stat, stat_map["kda"])
    values = [extractor(m) for m in matches]

    # Calculate rolling average
    points = []
    for i in range(len(values)):
        start = max(0, i - window + 1)
        window_vals = values[start:i+1]
        avg = sum(window_vals) / len(window_vals)

        m = matches[i]
        points.append({
            "match_index": i,
            "match_id": m.match_id,
            "value": round(extractor(m), 2),
            "rolling_avg": round(avg, 2),
            "date": m.played_at.isoformat() if m.played_at else None,
            "hero_id": m.hero_id,
            "result": m.result,
        })

    return {
        "stat": stat,
        "window": window,
        "points": points,
        "current_avg": round(points[-1]["rolling_avg"], 2) if points else 0,
        "first_avg": round(points[0]["rolling_avg"], 2) if points else 0,
        "change": round(
            points[-1]["rolling_avg"] - points[0]["rolling_avg"], 2
        ) if len(points) > 1 else 0,
    }


@router.get("/summary")
async def get_progress_summary(session: Session = Depends(get_session)):
    """Get overall progress summary with key metrics."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    # Recent 20 matches
    recent = session.exec(
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.played_at.desc())
        .limit(20)
    ).all()

    # Older 20 matches (for comparison)
    older = session.exec(
        select(Match)
        .where(Match.player_id == player.id)
        .order_by(Match.played_at.desc())
        .offset(20)
        .limit(20)
    ).all()

    def calc_avg(matches, attr, default=0):
        vals = [getattr(m, attr) or default for m in matches]
        return sum(vals) / max(len(vals), 1)

    def calc_kda(matches):
        return sum(
            ((m.kills or 0) + (m.assists or 0)) / max(m.deaths or 1, 1) for m in matches
        ) / max(len(matches), 1)

    def calc_winrate(matches):
        if not matches:
            return 0
        return sum(1 for m in matches if m.result == "win") / len(matches) * 100

    r_kda = calc_kda(recent)
    o_kda = calc_kda(older) if older else r_kda

    r_gpm = calc_avg(recent, "gpm")
    o_gpm = calc_avg(older, "gpm") if older else r_gpm

    r_deaths = calc_avg(recent, "deaths")
    o_deaths = calc_avg(older, "deaths") if older else r_deaths

    r_wr = calc_winrate(recent)
    o_wr = calc_winrate(older) if older else r_wr

    # Active action items
    active_items = session.exec(
        select(ActionItem)
        .where(ActionItem.player_id == player.id)
        .where(ActionItem.is_completed == False)
        .order_by(ActionItem.priority.asc())
        .limit(5)
    ).all()

    # Recent analysis scores
    recent_analyses = session.exec(
        select(MatchAnalysis)
        .where(MatchAnalysis.player_id == player.id)
        .order_by(MatchAnalysis.analyzed_at.desc())
        .limit(10)
    ).all()

    avg_perf_score = (
        sum(a.performance_score or 0 for a in recent_analyses) / max(len(recent_analyses), 1)
    ) if recent_analyses else 0

    return {
        "matches_analyzed": len(recent),
        "recent_winrate": round(r_wr, 1),
        "winrate_change": round(r_wr - o_wr, 1),
        "recent_kda": round(r_kda, 2),
        "kda_change": round(r_kda - o_kda, 2),
        "recent_gpm": round(r_gpm),
        "gpm_change": round(r_gpm - o_gpm),
        "recent_deaths": round(r_deaths, 1),
        "deaths_change": round(r_deaths - o_deaths, 1),
        "avg_performance_score": round(avg_perf_score, 1),
        "mmr_estimate": player.mmr_estimate,
        "rank_tier": player.rank_tier,
        "active_action_items": [
            {"id": a.id, "text": a.text, "category": a.category, "difficulty": a.difficulty}
            for a in active_items
        ],
    }


@router.post("/snapshot")
async def create_snapshot(session: Session = Depends(get_session)):
    """Manually trigger a progress snapshot."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    await create_progress_snapshot(session, player)
    return {"status": "created"}


@router.get("/action-items")
async def get_action_items(
    completed: bool = False,
    session: Session = Depends(get_session),
):
    """Get action items."""
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    items = session.exec(
        select(ActionItem)
        .where(ActionItem.player_id == player.id)
        .where(ActionItem.is_completed == completed)
        .order_by(ActionItem.priority.asc())
    ).all()

    return [
        {
            "id": a.id,
            "text": a.text,
            "category": a.category,
            "difficulty": a.difficulty,
            "priority": a.priority,
            "match_id": a.match_id,
            "is_completed": a.is_completed,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in items
    ]


@router.put("/action-items/{item_id}/complete")
async def complete_action_item(item_id: int, session: Session = Depends(get_session)):
    """Mark an action item as completed."""
    from datetime import datetime
    item = session.exec(select(ActionItem).where(ActionItem.id == item_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")

    item.is_completed = True
    item.completed_at = datetime.utcnow()
    session.commit()
    return {"status": "completed"}
