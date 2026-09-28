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
    from services.protracker import sync_hero_position_meta

    # Wait for app to fully start
    await asyncio.sleep(10)
    logger.info("Background sync loop started")

    # protracker_enabled/protracker_interval_hours have existed as
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
                    # at all. Heavier than the syncs above, so runs on
                    # its own longer interval instead of every cycle.
                    interval_hours = settings.protracker_interval_hours or 6
                    due = (
                        last_protracker_sync is None
                        or datetime.utcnow() - last_protracker_sync >= timedelta(hours=interval_hours)
                    )
                    if settings.protracker_enabled and due:
                        try:
                            await sync_hero_position_meta(session, settings)
                        except Exception as e:
                            logger.error(f"Background sync: hero_position_meta failed: {e}", exc_info=True)
                        last_protracker_sync = datetime.utcnow()

            session.close()

        except Exception as e:
            logger.error(f"Background sync error: {e}", exc_info=True)

        # Wait for configured interval (default 30 minutes)
        interval = 30
        if settings:
            interval = settings.sync_interval_minutes or 30
        await asyncio.sleep(interval * 60)



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

    # Start dedicated auto-parse worker (replay downloading + local parsing + OD requests)
    from services.auto_parse import auto_parse_worker
    parse_task = asyncio.create_task(auto_parse_worker())

    yield

    # Shutdown
    sync_task.cancel()
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
