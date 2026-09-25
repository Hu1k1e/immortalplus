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
    Background task that periodically syncs data.
    Runs match sync, progress snapshots, and meta updates.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings, Match
    from services.sync import (
        sync_player_matches, create_progress_snapshot,
        sync_hero_meta, sync_hero_matchups, fetch_match_details
    )

    # Wait for app to fully start
    await asyncio.sleep(10)
    logger.info("Background sync loop started")

    meta_synced = False

    while True:
        try:
            session = SessionLocal()
            settings = session.exec(select(UserSettings).limit(1)).first()
            player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()

            if player and settings and settings.auto_sync_matches:
                # Sync matches
                new_count = await sync_player_matches(session, player, settings)
                
                # Fetch detailed parsed data for matches that don't have it yet
                unparsed = session.exec(
                    select(Match)
                    .where(Match.player_id == player.id)
                    .where(Match.opendota_raw == None)
                    .order_by(Match.match_id.desc())
                    .limit(10)
                ).all()

                for m in unparsed:
                    logger.info(f"Background fetching parsed details for {m.match_id}")
                    success = await fetch_match_details(session, m, settings)
                    if success:
                        session.commit()

                # Create daily snapshot
                await create_progress_snapshot(session, player)

            # Sync meta data (less frequently)
            if not meta_synced and settings:
                await sync_hero_meta(session, settings)
                meta_synced = True

            session.close()

        except Exception as e:
            logger.error(f"Background sync error: {e}")

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

    # Start background sync
    sync_task = asyncio.create_task(background_sync_loop())

    yield

    # Shutdown
    sync_task.cancel()
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
