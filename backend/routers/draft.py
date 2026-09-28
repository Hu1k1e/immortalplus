"""
Draft helper endpoints.
Uses GSI data + cached meta to suggest hero picks during draft phase.
"""

import asyncio
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlmodel import select

from database import get_session
from models import Player, UserSettings, HeroMatchup, HeroPositionMeta, HeroMeta, HeroSynergy, Match
from services.draft_engine import calculate_role_based_suggestions, compute_personal_position_stats
from services.protracker import sync_hero_position_meta
from services.sync import sync_hero_meta, sync_hero_matchups, sync_hero_synergy
from utils.dota_constants import get_hero_id_by_name, rank_tier_to_bracket

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/draft", tags=["draft"])

# In-memory GSI state (updated by GSI webhook)
_gsi_state = {
    "active": False,
    "phase": None,       # "strategy", "ban", "pick", "playing"
    "ally_picks": [],
    "enemy_picks": [],
    "bans": [],
    "game_time": 0,
}

# Connected WebSocket clients for live draft updates
_ws_clients: list[WebSocket] = []


@router.post("/suggest")
async def suggest_picks(
    ally_picks: list[int] = [],
    enemy_picks: list[int] = [],
    bans: list[int] = [],
    session: Session = Depends(get_session),
):
    """
    Get hero pick suggestions, grouped by the 5 real Dota positions
    (Carry/Mid/Offlane/Soft Support/Hard Support), each with 3 ranked
    lists: best this patch, your best, and a blended overall suggestion.
    See services/draft_engine.py for the scoring model and why it's
    structured this way.
    """
    player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()

    if not player:
        raise HTTPException(status_code=404, detail="No player profile found")

    # Hero matchup data (X vs each enemy hero), from DB — populated by
    # the background sync loop (services/sync.py:sync_hero_matchups).
    hero_matchups: dict[int, list[dict]] = {}
    matchups = session.exec(select(HeroMatchup)).all()
    for mu in matchups:
        hero_matchups.setdefault(mu.hero_id, []).append({
            "hero_id": mu.enemy_hero_id,
            "advantage": mu.advantage or 0,
        })

    # Current-patch per-position meta (Dota2ProTracker), from DB.
    hero_position_meta: dict[int, dict[int, dict]] = {p: {} for p in range(1, 6)}
    position_metas = session.exec(select(HeroPositionMeta)).all()
    for pm in position_metas:
        if pm.position in hero_position_meta:
            hero_position_meta[pm.position][pm.hero_id] = {
                "winrate": pm.winrate,
                "matches": pm.matches,
                "d2pt_rating": pm.d2pt_rating,
            }

    # Player's own match history, bucketed into positions — prefers the
    # real Stratz-provided position when available, falling back to a
    # lane_role+GPM heuristic otherwise (see draft_engine.estimate_position).
    player_matches = session.exec(
        select(Match).where(Match.player_id == player.id).where(Match.hero_id.is_not(None))
    ).all()
    personal_position_stats = compute_personal_position_stats(player_matches)

    # Overall hero winrate at the PLAYER'S OWN rank bracket (OpenDota
    # HeroMeta) — position-agnostic but rank-specific, the opposite
    # tradeoff from HeroPositionMeta (position-specific but high-MMR/pro
    # only). draft_engine blends the two so the meta score reflects the
    # player's actual rank, not just what's strong among top players.
    hero_meta_at_rank: dict[int, dict] = {}
    bracket = rank_tier_to_bracket(player.rank_tier or 0)
    metas = session.exec(select(HeroMeta).where(HeroMeta.rank_bracket == bracket)).all()
    for m in metas:
        hero_meta_at_rank[m.hero_id] = {"winrate": m.winrate}

    # Real ally-pair synergy (Stratz only — see sync_hero_synergy). Empty
    # dict (not an error) if no Stratz token is configured; draft_engine
    # treats a hero with no synergy rows as neutral, same as missing
    # matchup data.
    hero_synergy: dict[int, list[dict]] = {}
    synergies = session.exec(select(HeroSynergy)).all()
    for hs in synergies:
        hero_synergy.setdefault(hs.hero_id, []).append({
            "hero_id": hs.ally_hero_id,
            "synergy": hs.synergy,
        })

    by_role = calculate_role_based_suggestions(
        ally_picks=ally_picks,
        enemy_picks=enemy_picks,
        bans=bans,
        hero_position_meta=hero_position_meta,
        personal_position_stats=personal_position_stats,
        hero_matchups=hero_matchups,
        hero_meta_at_rank=hero_meta_at_rank,
        hero_synergy=hero_synergy,
    )

    # {hero_id: {position: matches}} — how commonly each hero is played
    # at each position, straight from HeroPositionMeta. Not a guess: the
    # frontend uses this to figure out which position an ALREADY-PICKED
    # hero most likely fills (GSI has no "queued role" field — confirmed
    # directly against the real GSI schema, this app's only real signal
    # for "what position is this pick" is which position that hero is
    # most commonly played at).
    hero_position_fit: dict[int, dict[int, int]] = {}
    for position, heroes in hero_position_meta.items():
        for hero_id, stats in heroes.items():
            hero_position_fit.setdefault(hero_id, {})[position] = stats.get("matches") or 0

    return {
        "by_role": by_role,
        "hero_position_fit": hero_position_fit,
        "ally_picks": ally_picks,
        "enemy_picks": enemy_picks,
        "bans": bans,
    }



# In-memory status for the manual refresh — see refresh_meta's docstring
# for why this doesn't just await everything and return.
_refresh_status: dict = {"state": "idle", "results": {}, "started_at": None, "finished_at": None}


async def _run_refresh_meta():
    """
    The actual sync work, run as a background task (see refresh_meta).
    Opens its own DB session since the request that triggered this
    returns long before this finishes.
    """
    from database import SessionLocal

    _refresh_status["state"] = "running"
    _refresh_status["results"] = {}
    _refresh_status["started_at"] = datetime.utcnow().isoformat()

    session = SessionLocal()
    try:
        settings = session.exec(select(UserSettings).limit(1)).first()

        try:
            count = await sync_hero_meta(session, settings)
            _refresh_status["results"]["hero_meta"] = {"status": "ok", "count": count}
        except Exception as e:
            logger.error(f"Manual refresh: hero_meta sync failed: {e}", exc_info=True)
            _refresh_status["results"]["hero_meta"] = {"status": "error", "message": str(e)}

        try:
            count = await sync_hero_matchups(session, settings)
            _refresh_status["results"]["hero_matchups"] = {"status": "ok", "count": count}
        except Exception as e:
            logger.error(f"Manual refresh: hero_matchups sync failed: {e}", exc_info=True)
            _refresh_status["results"]["hero_matchups"] = {"status": "error", "message": str(e)}

        try:
            count = await sync_hero_position_meta(session, settings)
            _refresh_status["results"]["hero_position_meta"] = {"status": "ok" if count else "error", "count": count}
        except Exception as e:
            logger.error(f"Manual refresh: hero_position_meta sync failed: {e}", exc_info=True)
            _refresh_status["results"]["hero_position_meta"] = {"status": "error", "message": str(e)}

        # Optional — no-ops (0, not an error) if no Stratz token is configured.
        try:
            count = await sync_hero_synergy(session, settings)
            _refresh_status["results"]["hero_synergy"] = {"status": "ok", "count": count}
        except Exception as e:
            logger.error(f"Manual refresh: hero_synergy sync failed: {e}", exc_info=True)
            _refresh_status["results"]["hero_synergy"] = {"status": "error", "message": str(e)}
    finally:
        session.close()
        _refresh_status["state"] = "done"
        _refresh_status["finished_at"] = datetime.utcnow().isoformat()


@router.post("/refresh-meta")
async def refresh_meta():
    """
    Manual trigger for an immediate meta/matchup/position-meta/synergy
    resync, for the "Refresh Meta Data" button — rather than waiting for
    the background loop's next scheduled cycle.

    Runs as a background task instead of awaiting everything inline: a
    full resync (hero_matchups alone rate-limits itself to 30 heroes at
    1.5s apart, hero_synergy similarly at ~30x1s) genuinely takes over a
    minute end to end — confirmed directly from production logs, where
    the sync was working correctly the whole time but the button showed
    "failed" because the HTTP request timed out waiting for it. The
    frontend now polls GET /refresh-meta/status instead of waiting on
    this response.
    """
    if _refresh_status["state"] == "running":
        return {"status": "already_running"}
    asyncio.create_task(_run_refresh_meta())
    return {"status": "started"}


@router.get("/refresh-meta/status")
async def refresh_meta_status():
    return _refresh_status


# How stale a source can get before the UI should flag it rather than
# just show a green dot — matches roughly double each source's own sync
# interval, so a single slightly-late cycle doesn't look alarming.
_STALE_AFTER_HOURS = {
    "hero_meta": 1.0,          # syncs every background cycle (~30 min default)
    "hero_matchups": 1.0,
    "hero_position_meta": 14.0,  # syncs every protracker_interval_hours (default 6h)
    "hero_synergy": 1.0,
}


@router.get("/data-health")
async def data_health(session: Session = Depends(get_session)):
    """
    Real counts and last-updated time for every data source the draft
    engine actually reads, so "do we have the data" is answerable by
    looking at this endpoint instead of grepping docker logs — directly
    requested after two rounds of "still shows no data" reports that
    each turned out to have a real, different root cause once actually
    investigated. Every number here is a live DB query, not cached.
    """
    now = datetime.utcnow()

    def source_health(model, label: str):
        count = session.exec(select(func.count()).select_from(model)).one()
        last_updated = session.exec(select(func.max(model.updated_at))).one()
        stale_after = _STALE_AFTER_HOURS[label]
        age_hours = (now - last_updated).total_seconds() / 3600 if last_updated else None
        if count == 0:
            status = "empty"
        elif age_hours is not None and age_hours > stale_after:
            status = "stale"
        else:
            status = "ok"
        return {
            "label": label,
            "count": count,
            "last_updated": last_updated.isoformat() if last_updated else None,
            "age_hours": round(age_hours, 1) if age_hours is not None else None,
            "status": status,
        }

    settings = session.exec(select(UserSettings).limit(1)).first()

    sources = [
        source_health(HeroMeta, "hero_meta"),
        source_health(HeroMatchup, "hero_matchups"),
        source_health(HeroPositionMeta, "hero_position_meta"),
        source_health(HeroSynergy, "hero_synergy"),
    ]
    # hero_synergy and the Stratz path for hero_position_meta are both
    # genuinely optional (no token = intentionally inactive, not broken) —
    # don't flag them "empty" as if something's wrong when there's simply
    # no token configured to make them do anything.
    has_stratz = bool(settings and getattr(settings, "stratz_api_token", None))
    for s in sources:
        if s["label"] == "hero_synergy" and not has_stratz and s["count"] == 0:
            s["status"] = "not_configured"

    return {
        "sources": sources,
        "overall": "ok" if all(s["status"] in ("ok", "not_configured") for s in sources) else "attention_needed",
        "checked_at": now.isoformat(),
    }


@router.get("/state")
async def get_draft_state():
    """Get current GSI draft state."""
    return _gsi_state


@router.post("/screen-report")
async def report_screen_scan(
    ally_picks: list[int] = [],
    enemy_picks: list[int] = [],
    bans: list[int] = [],
):
    """
    Ingest picks/bans identified by the local draft-scanner companion app
    (see draft-scanner/) via screen-capture + hero-icon template matching.

    This exists because Valve deliberately blanks pick/ban visibility from
    every API-level channel during the draft (GSI, and — confirmed via
    Valve's patch 7.35d changelog notes, in response to the "OverPlus"
    controversy — even Overwolf's own officially-sanctioned game-events
    integration) for every mode except Captain's Mode. Screen-reading is
    the one channel that isn't blocked, since it only reads pixels already
    rendered to the player's own monitor rather than any privileged data
    channel — same category as OBS/Discord screen share, not game-memory
    access (see draft-scanner/main.py's docstring).

    _gsi_state is still the single source of truth for /suggest and the
    websocket — this just feeds it from a second, resolution-limited
    source when GSI's own draft block comes back empty (e.g. All Pick).
    A slot GSI has already identified is never overwritten with a
    screen-detected empty result, so a temporarily-failed match doesn't
    regress an already-confirmed pick.
    """
    if ally_picks:
        _gsi_state["ally_picks"] = ally_picks
    if enemy_picks:
        _gsi_state["enemy_picks"] = enemy_picks
    if bans:
        _gsi_state["bans"] = bans

    await maybe_broadcast_draft_update()
    return {"status": "ok", "state": _gsi_state}


@router.websocket("/ws")
async def draft_websocket(ws: WebSocket):
    """WebSocket for real-time draft updates from GSI."""
    await ws.accept()
    _ws_clients.append(ws)
    try:
        while True:
            # Keep connection alive, send state on change
            data = await ws.receive_text()
            # Client can send manual pick updates
            try:
                msg = json.loads(data)
                if msg.get("type") == "update_picks":
                    _gsi_state["ally_picks"] = msg.get("ally_picks", [])
                    _gsi_state["enemy_picks"] = msg.get("enemy_picks", [])
                    _gsi_state["bans"] = msg.get("bans", [])
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        _ws_clients.remove(ws)


async def broadcast_draft_update(state: dict):
    """Broadcast draft state to all connected WebSocket clients."""
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_json(state)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.remove(ws)


# Snapshot of the fields that actually matter to a viewer, so a broadcast
# only fires on a real change — not on every GSI packet. Dota posts GSI
# updates multiple times per second while a draft is active; broadcasting
# unconditionally on every one of those (the original behavior) made the
# frontend re-fetch and blank its suggestions panel every ~second even
# though nothing had changed, which is exactly the flicker reported.
_last_broadcast_snapshot: dict | None = None


async def maybe_broadcast_draft_update():
    global _last_broadcast_snapshot
    snapshot = {
        "active": _gsi_state["active"],
        "phase": _gsi_state["phase"],
        "ally_picks": list(_gsi_state["ally_picks"]),
        "enemy_picks": list(_gsi_state["enemy_picks"]),
        "bans": list(_gsi_state["bans"]),
    }
    if snapshot != _last_broadcast_snapshot:
        _last_broadcast_snapshot = snapshot
        await broadcast_draft_update(_gsi_state)


def _resolve_hero_id(value) -> int | None:
    """A single GSI pick/ban slot can show up as a numeric hero_id directly,
    or as a real npc class name string (e.g. "npc_dota_hero_antimage") — the
    exact real shape wasn't confirmed against a live game when this was
    first written, so this accepts either rather than assuming one."""
    if value is None:
        return None
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, str):
        if value.isdigit():
            iv = int(value)
            return iv if iv > 0 else None
        return get_hero_id_by_name(value)
    return None


def _extract_slots(team_data: dict, prefix: str) -> list[int]:
    """Reads GSI's real flat-field draft shape for one team — numbered
    slots like pick0_id/pick0_class, pick1_id/pick1_class, ... (confirmed
    against the community reference implementation of Dota 2's GSI schema,
    since Valve's own docs don't cover this) — NOT the nested
    {"picks": [{"id": ...}]} array this code originally, incorrectly,
    assumed. Tries "<prefix>N_id" first (if GSI ever sends a numeric id
    directly), falls back to resolving "<prefix>N_class" (the real npc
    name) through the hero name table. Stops at the first completely
    absent slot rather than assuming a fixed count, since pick/ban counts
    differ between game modes.
    """
    out = []
    i = 0
    while True:
        id_key = f"{prefix}{i}_id"
        class_key = f"{prefix}{i}_class"
        if id_key not in team_data and class_key not in team_data:
            break
        hero_id = _resolve_hero_id(team_data.get(id_key)) or _resolve_hero_id(team_data.get(class_key))
        if hero_id:
            out.append(hero_id)
        i += 1
    return out


def update_gsi_draft_state(gsi_data: dict):
    """
    Parse GSI payload and update draft state.
    Called from the GSI router when draft data arrives.

    IMPORTANT — this was never verified against a real live match before
    this pass (the user flagged it as an untested first draft, and that
    was correct). The original version's team2/team3 keys turned out to
    be right (matches Dota's real team-number convention: 2=Radiant,
    3=Dire — confirmed against raw, non-AI-summarized source from an
    independent GSI library), but its nested picks[]/bans[] array shape
    was wrong — real GSI uses flat pickN_id/pickN_class, banN_id/banN_class
    fields per team, which this version reads instead. (An intermediate
    pass briefly changed the team keys to team0/team1 based on an
    imprecise secondhand summary of a different library — reverted once
    checked against that library's actual raw text.) Also logs the raw
    draft block below so real matches confirm or correct any remaining
    assumption from actual evidence — see the logger.info calls in this
    function. Real testing this session (Ranked All Pick, via a private
    bot lobby) showed the "draft" block itself coming back completely
    empty every time, which community reports elsewhere confirm is a
    known Valve-side gap for some game modes (Captain's Mode is the one
    mode with confirmed-working draft GSI data) — see
    research/build_plan.md or the project changelog for the current
    understanding of which modes this actually works in.
    """
    map_data = gsi_data.get("map", {})
    game_state = map_data.get("game_state", "")

    if game_state in ("DOTA_GAMERULES_STATE_HERO_SELECTION", "DOTA_GAMERULES_STATE_STRATEGY_TIME"):
        # A fresh draft starting (we were inactive a moment ago, now
        # we're not) has to wipe whatever picks/bans are left over from
        # the previous match — otherwise a stale pick from a game that
        # already ended sits in _gsi_state forever, since screen-report's
        # "never overwrite with an empty result" protection (there to
        # stop one bad OCR/match frame from erasing an already-confirmed
        # pick WITHIN a draft) also blocks the legitimate empty state a
        # brand new draft starts in. Confirmed hitting this directly: a
        # hero from an earlier game stayed shown as picked into the next
        # one. GSI's own game_state is reliable here even in All Pick —
        # it's only the pick/ban *content* Valve blanks, not the phase.
        if not _gsi_state["active"]:
            _gsi_state["ally_picks"] = []
            _gsi_state["enemy_picks"] = []
            _gsi_state["bans"] = []

        _gsi_state["active"] = True
        _gsi_state["phase"] = "pick" if "HERO_SELECTION" in game_state else "strategy"

        draft = gsi_data.get("draft", {})
        # Unconditional, every call during pick/strategy phase — unlike the
        # block below, this fires even when "draft" comes back empty/absent,
        # which is exactly the case that needs diagnosing: the previous
        # version only logged once real pick data was already found, so it
        # went completely silent when the draft block itself was the
        # problem rather than the parsing of it.
        logger.info(
            f"[GSI draft] game_state={game_state} top_level_keys={sorted(gsi_data.keys())} "
            f"draft_present={'draft' in gsi_data} draft_raw={draft!r}"
        )
        if draft:
            # Real GSI team keys are team2 (Radiant) and team3 (Dire) —
            # matching Dota's real internal team-number convention
            # (DOTA_TEAM_GOODGUYS=2, DOTA_TEAM_BADGUYS=3). An earlier pass
            # changed this to team0/team1 based on an imprecise secondhand
            # read of a different library; verified directly against raw
            # (non-AI-summarized) source from a second, independent GSI
            # library confirming team2/team3 explicitly, so reverted back
            # to what the very first version of this file already had.
            # Still use the "home_team" flag rather than hardcoding
            # team2=Radiant, since that's the one genuinely documented,
            # authoritative signal for which side is which.
            player_team_name = gsi_data.get("player", {}).get("team_name")
            team2 = draft.get("team2", {})
            team3 = draft.get("team3", {})
            team2_is_home = team2.get("home_team")

            # "home_team" in GSI corresponds to Radiant. Fall back to the
            # player's own team_name if home_team isn't present for some
            # reason, rather than silently guessing team2.
            if team2_is_home is not None:
                radiant_team, dire_team = (team2, team3) if team2_is_home else (team3, team2)
            else:
                radiant_team, dire_team = (team2, team3)

            ally_is_radiant = player_team_name != "dire"
            ally_team_data = radiant_team if ally_is_radiant else dire_team
            enemy_team_data = dire_team if ally_is_radiant else radiant_team

            _gsi_state["ally_picks"] = _extract_slots(ally_team_data, "pick")
            _gsi_state["enemy_picks"] = _extract_slots(enemy_team_data, "pick")
            # Ranked All Pick auto-bans a small number of heroes before
            # picking starts (confirmed real — not a Captains Mode-only
            # thing as first assumed); Captains Mode has player-driven
            # bans on top of that. Both use the same banN_id/banN_class
            # slot shape as picks, read from both sides.
            _gsi_state["bans"] = (
                _extract_slots(ally_team_data, "ban") + _extract_slots(enemy_team_data, "ban")
            )

            logger.info(
                f"[GSI draft] raw team2={team2} team3={team3} player_team={player_team_name} "
                f"-> parsed ally_picks={_gsi_state['ally_picks']} "
                f"enemy_picks={_gsi_state['enemy_picks']} bans={_gsi_state['bans']}"
            )

    elif game_state == "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS":
        # Symmetric with the inactive->active clear above: leaving the
        # draft phase must also drop whatever was picked, or a finished
        # draft's picks stay shown as if still live all through the game
        # and into the next "waiting for draft" state — confirmed hitting
        # exactly this (a hero from the last draft still showing at a
        # position during "Waiting for Dota 2 draft phase to begin").
        if _gsi_state["active"]:
            _gsi_state["ally_picks"] = []
            _gsi_state["enemy_picks"] = []
            _gsi_state["bans"] = []
        _gsi_state["active"] = False
        _gsi_state["phase"] = "playing"
    else:
        if _gsi_state["active"]:
            _gsi_state["ally_picks"] = []
            _gsi_state["enemy_picks"] = []
            _gsi_state["bans"] = []
        _gsi_state["active"] = False
        _gsi_state["phase"] = None

    _gsi_state["game_time"] = map_data.get("clock_time", 0)
