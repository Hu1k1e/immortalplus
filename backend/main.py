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
    from sqlmodel import select
    from database import SessionLocal
    from models import Player, UserSettings
    from services.sync import (
        sync_player_matches, create_progress_snapshot,
        sync_hero_meta,
    )

    # Wait for app to fully start
    await asyncio.sleep(10)
    logger.info("Background sync loop started")

    meta_synced = False

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

            # Sync meta data once per app restart
            if not meta_synced and settings:
                await sync_hero_meta(session, settings)
                meta_synced = True

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
