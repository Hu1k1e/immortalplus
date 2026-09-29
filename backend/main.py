"""
Immortal+ Backend — FastAPI Application Entry Point
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_URL, BACKEND_PORT
from database import init_db, auto_migrate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("immortalplus")


async def background_sync_loop():
    """
    Background task: periodically syncs match history and meta data.
    Replay parsing is handled by the separate auto_parse_worker task.
    """
    from datetime import datetime, timedelta
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings
    from services.sync import (
        sync_player_matches, create_progress_snapshot,
        sync_hero_meta, sync_hero_matchups, sync_hero_synergy, meta_sync_lock,
    )
    from services.protracker import sync_hero_position_meta, sync_hero_position_detail

    # Wait for app to fully start
    await asyncio.sleep(10)
    logger.info("Background sync loop started")

    # protracker_enabled/protracker_interval_minutes have existed as
    # UserSettings fields since early in this project but were never
    # actually read anywhere — this is the first real use of them. Runs
    # on its own longer interval (default 6h) rather than every cycle
    # like meta/matchups above, since it's a heavier browser-automation
    # fetch (see services/protracker.py), not a plain API call.
    last_protracker_sync: datetime | None = None

    while True:
        settings = None
        try:
            session = SessionLocal()
            settings = session.exec(select(UserSettings).limit(1)).first()
            player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()

            if player and settings and settings.auto_sync_matches:
                # Sync new matches from OpenDota into DB
                new_count = await sync_player_matches(session, player, settings)
                if new_count:
                    logger.info(f"Synced {new_count} new matches — auto-parse worker will process them")

                # Create daily snapshot
                await create_progress_snapshot(session, player)

            # Hero win/pick rates + matchup (counter-pick) data for the
            # Draft Helper — previously meta only synced once per restart
            # and matchups never synced at all, so this data could go
            # stale for weeks and matchups were always empty. Both now run
            # every cycle (same interval as everything else below); meta
            # is one cheap API call, matchups covers 30 heroes per cycle
            # (rotating through whichever are most stale — see
            # sync_hero_matchups), so this stays well within normal API
            # rate limits even at the default 30-minute interval.
            #
            # Each call gets its own try/except — sync_hero_meta and
            # sync_hero_matchups now raise on failure instead of
            # swallowing it internally (so /refresh-meta's manual button
            # can report real per-source success/failure), which meant
            # one of them failing used to skip every sync after it in
            # this block for the whole cycle, including the one that
            # actually populates HeroPositionMeta below — confirmed
            # hitting this directly (position-meta stayed empty in
            # production). One source failing must never block the rest.
            if settings:
                # Shared with the manual "Refresh Meta Data" button
                # (routers/draft.py) — without this lock the two could
                # run these same syncs concurrently, each slowing the
                # other down and making a data-health check mid-overlap
                # show a source as "stale" when it was really just still
                # mid-cycle. See meta_sync_lock's docstring.
                async with meta_sync_lock:
                    try:
                        await sync_hero_meta(session, settings)
                    except Exception as e:
                        logger.error(f"Background sync: hero_meta failed: {e}", exc_info=True)

                    try:
                        await sync_hero_matchups(session, settings)
                    except Exception as e:
                        logger.error(f"Background sync: hero_matchups failed: {e}", exc_info=True)

                    try:
                        # Real ally-synergy data (Stratz only — no-ops if
                        # no token configured, see sync_hero_synergy's
                        # docstring).
                        await sync_hero_synergy(session, settings)
                    except Exception as e:
                        logger.error(f"Background sync: hero_synergy failed: {e}", exc_info=True)

                    # Dota2ProTracker/Stratz: real per-position (Carry/
                    # Mid/Offlane/Soft Support/Hard Support) hero win
                    # rates — data OpenDota's bulk endpoints don't have
                    # at all. Configurable independently of the general
                    # sync_interval_minutes cadence above (defaults to the
                    # same 30 minutes) since it's a heavier scrape.
                    interval_minutes = settings.protracker_interval_minutes or 30
                    due = (
                        last_protracker_sync is None
                        or datetime.utcnow() - last_protracker_sync >= timedelta(minutes=interval_minutes)
                    )
                    if settings.protracker_enabled and due:
                        try:
                            await sync_hero_position_meta(session, settings)
                        except Exception as e:
                            logger.error(f"Background sync: hero_position_meta failed: {e}", exc_info=True)
                        # Same interval/gate as hero_position_meta above —
                        # the Meta page's richer table (lane advantage,
                        # contest rate, Radiant/Dire and pick-phase splits)
                        # is scraped from ProTracker at the same cadence
                        # requested directly ("pulled as the same rate as
                        # how we do the draft section").
                        try:
                            await sync_hero_position_detail(session)
                        except Exception as e:
                            logger.error(f"Background sync: hero_position_detail failed: {e}", exc_info=True)
                        last_protracker_sync = datetime.utcnow()

            session.close()

        except Exception as e:
            logger.error(f"Background sync error: {e}", exc_info=True)

        # Wait for configured interval (default 30 minutes)
        interval = 30
        if settings:
            interval = settings.sync_interval_minutes or 30
        await asyncio.sleep(interval * 60)



async def steam_match_poll_loop():
    """
    Fast-path new-match discovery — polls Steam's own GetMatchHistory
    directly (see services/sync.py's sync_new_matches_from_steam) at a
    much tighter interval than the general background_sync_loop's ~30
    minutes, since it's Valve's own authoritative source rather than a
    third-party re-index of it: a just-finished match can show up here
    within about a minute instead of waiting on OpenDota/Stratz to notice
    it. Deliberately a separate, lightweight loop rather than folded into
    background_sync_loop's single 30-minute timer — the whole point is
    polling far more often than that loop runs — but it feeds the exact
    same Match table and downstream pipeline (auto-parse, analysis, etc.)
    as every other sync path, so a match found this way is otherwise
    indistinguishable from one OpenDota/Stratz found first.

    Requires the linked account to have "Expose Public Match Data"
    enabled in the Dota 2 client (see the Settings page's explainer) and
    a steam_api_key configured; silently does nothing (no error spam) for
    an account that doesn't have this on, same as any other genuinely-
    optional data source in this app.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings
    from services.sync import sync_new_matches_from_steam

    await asyncio.sleep(20)  # let the app finish starting first
    logger.info("Steam match fast-path poll loop started")

    while True:
        try:
            session = SessionLocal()
            try:
                player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
                settings = session.exec(select(UserSettings).limit(1)).first()
                if player and settings:
                    await sync_new_matches_from_steam(session, player, settings)
            finally:
                session.close()
        except Exception as e:
            logger.error(f"Steam match fast-path poll failed: {e}", exc_info=True)

        await asyncio.sleep(90)


async def run_history_backfill_once():
    """
    One-shot full match-history backfill (see services/sync.py's
    sync_full_match_history docstring for why this exists — the regular
    background_sync_loop only ever fetches the newest N matches forward
    from whatever's already stored, never a fresh account's older
    history). Runs once at startup for whichever player is linked and
    hasn't been backfilled yet (Player.history_backfilled_at is None),
    then exits — the flag it sets prevents this from re-running every
    restart. A multi-thousand-game account can take a couple minutes
    (paced, see _BACKFILL_MAX_PAGES/sleep in sync.py), so this runs as
    its own background task rather than blocking startup or the regular
    sync loop.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings
    from services.sync import sync_full_match_history

    await asyncio.sleep(15)  # let the app finish starting first

    session = SessionLocal()
    try:
        player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
        settings = session.exec(select(UserSettings).limit(1)).first()
        if player and not player.history_backfilled_at:
            logger.info(f"Starting one-time full match-history backfill for player {player.account_id}")
            try:
                await sync_full_match_history(session, player, settings)
            except Exception as e:
                logger.error(f"History backfill failed: {e}", exc_info=True)
    finally:
        session.close()


async def refresh_player_identity_once():
    """
    One-shot persona name / avatar resolution, run at every container
    startup — directly requested after the profile picture kept showing
    as unset even once the resolution logic itself was fixed: a stored
    Player row's persona_name/avatar_url only ever changes when something
    calls resolve_persona_avatar (see services/player_identity.py), which
    previously only happened from a manual Settings action, so a player
    linked before that fix (or whose Stratz/Steam data simply wasn't
    available yet) stayed stuck on whatever it was first set to. Running
    this unconditionally on every boot means a redeploy alone is enough to
    pick up newly-available data, without the user needing to find and
    click a refresh button.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings
    from services.opendota import get_opendota_client
    from services.player_identity import resolve_persona_avatar

    await asyncio.sleep(12)  # let the app finish starting first

    session = SessionLocal()
    try:
        player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()
        if not player or not player.account_id:
            return
        settings = session.exec(select(UserSettings).limit(1)).first()

        opendota_profile = {}
        try:
            client = get_opendota_client(settings.opendota_api_key if settings else None)
            data = await client.get_player(player.account_id)
            opendota_profile = data.get("profile") or {}
        except Exception as e:
            logger.info(f"Startup profile refresh: OpenDota lookup failed (non-fatal, other sources still tried): {e}")

        persona_name, avatar_url, profile_url = await resolve_persona_avatar(
            player.account_id, player.steam_id, opendota_profile, settings,
        )
        persona_name = persona_name or player.persona_name
        avatar_url = avatar_url or player.avatar_url
        profile_url = profile_url or player.profile_url

        if (persona_name, avatar_url, profile_url) != (player.persona_name, player.avatar_url, player.profile_url):
            player.persona_name = persona_name
            player.avatar_url = avatar_url
            player.profile_url = profile_url
            session.commit()
            logger.info(f"Startup profile refresh: updated persona_name/avatar_url for player {player.account_id}")
        else:
            logger.info("Startup profile refresh: no change")
    except Exception as e:
        logger.error(f"Startup profile refresh failed: {e}", exc_info=True)
    finally:
        session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    # Startup
    logger.info("Immortal+ Backend starting...")
    init_db()
    auto_migrate()
    logger.info("Database initialized")

    # Start background sync (match history, progress snapshots, meta)
    sync_task = asyncio.create_task(background_sync_loop())

    # One-time full-history backfill (see run_history_backfill_once) —
    # separate task from the regular sync loop so it doesn't block or
    # get blocked by that loop's own 30-min cycle.
    backfill_task = asyncio.create_task(run_history_backfill_once())

    # One-shot persona name/avatar resolution — see
    # refresh_player_identity_once's docstring.
    identity_task = asyncio.create_task(refresh_player_identity_once())

    # Fast-path new-match discovery via Steam's own GetMatchHistory — see
    # steam_match_poll_loop's docstring.
    steam_poll_task = asyncio.create_task(steam_match_poll_loop())

    # Start dedicated auto-parse worker (replay downloading + local parsing + OD requests)
    from services.auto_parse import auto_parse_worker
    parse_task = asyncio.create_task(auto_parse_worker())

    yield

    # Shutdown
    sync_task.cancel()
    backfill_task.cancel()
    identity_task.cancel()
    steam_poll_task.cancel()
    parse_task.cancel()
    logger.info("Immortal+ Backend shutting down")


app = FastAPI(
    title="Immortal+ Dota 2 Coach",
    description="Comprehensive Dota 2 coaching platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:9485",
        "http://localhost:5173",
        "http://127.0.0.1:9485",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers import player, matches, settings, meta, draft, progress, gsi

app.include_router(player.router)
app.include_router(matches.router)
app.include_router(settings.router)
app.include_router(meta.router)
app.include_router(draft.router)
app.include_router(progress.router)
app.include_router(gsi.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "Immortal+", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=BACKEND_PORT, reload=True)
