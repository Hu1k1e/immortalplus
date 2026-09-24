"""
Game State Integration (GSI) endpoint.
Receives JSON payloads from the Dota 2 client via official GSI mechanism.
This is 100% safe — GSI is an intended Valve feature for third-party tools.
"""

import logging
from fastapi import APIRouter, Request
from routers.draft import update_gsi_draft_state, broadcast_draft_update, _gsi_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gsi", tags=["gsi"])


@router.post("")
async def receive_gsi(request: Request):
    """
    Receive Game State Integration payloads from the Dota 2 client.
    
    Setup: Place this file in Dota 2's cfg directory:
    Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/
    
    File: gamestate_integration_immortalplus.cfg
    Content:
    "Immortal+ Coach"
    {
        "uri"           "http://localhost:8000/api/gsi"
        "timeout"       "5.0"
        "buffer"        "0.1"
        "throttle"      "0.5"
        "heartbeat"     "30.0"
        "data"
        {
            "provider"      "1"
            "map"           "1"
            "player"        "1"
            "hero"          "1"
            "abilities"     "1"
            "items"         "1"
            "draft"         "1"
        }
    }
    """
    try:
        gsi_data = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    # Update draft state if in pick phase
    update_gsi_draft_state(gsi_data)

    # Broadcast to WebSocket clients
    if _gsi_state["active"]:
        import asyncio
        asyncio.create_task(broadcast_draft_update(_gsi_state))

    return {"status": "ok"}


@router.get("/config")
async def get_gsi_config():
    """
    Returns the GSI config file contents that the user needs to place
    in their Dota 2 cfg directory.
    """
    config = '''"Immortal+ Coach"
{
    "uri"           "http://localhost:8000/api/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.5"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "1"
        "draft"         "1"
    }
}'''
    return {
        "config": config,
        "path": "Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_immortalplus.cfg",
        "instructions": [
            "1. Copy the config content above",
            "2. Create a new file at the path shown above",
            "3. Paste the config content and save",
            "4. Restart Dota 2",
            "5. The game will now send data to Immortal+ during matches",
        ],
    }
