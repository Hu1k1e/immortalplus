"""
draft-scanner main loop.

Runs on the SAME machine as the Dota 2 client (not the backend server —
this needs real screen access). Polls the backend's existing
/api/draft/state (already fed by GSI) to know when a draft is active,
then captures the screen and identifies picks/bans by template-matching
hero portraits against reference icons — the one channel Valve hasn't
locked down, since it just reads pixels already rendered to the monitor
(same category as OBS/Discord screen share, not game-memory access).

See regions.py for the current calibration status before relying on this.
"""

import logging
import time

import requests

from config import BACKEND_URL, PHASE_POLL_INTERVAL_S, CAPTURE_INTERVAL_S
from hero_icons import fetch_hero_icons
from matcher import identify_hero
from regions import PICK_SLOTS, BAN_SLOTS, to_pixels
from window_capture import capture_dota_window

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("draft-scanner")


def is_draft_active() -> bool:
    try:
        resp = requests.get(f"{BACKEND_URL}/api/draft/state", timeout=5)
        resp.raise_for_status()
        state = resp.json()
        return bool(state.get("active")) and state.get("phase") in ("pick", "strategy")
    except Exception as e:
        logger.warning(f"Failed to poll draft state: {e}")
        return False


def scan_once(hero_icons: dict) -> dict | None:
    screen = capture_dota_window()
    if screen is None:
        logger.warning("Dota 2 window not found — skipping this scan (is the game minimized or closed?)")
        return None
    h, w = screen.shape[:2]

    def scan_slots(slots):
        heroes = []
        for region in slots:
            x, y, rw, rh = to_pixels(region, w, h)
            crop = screen[y:y + rh, x:x + rw]
            hero_id, confidence = identify_hero(crop, hero_icons)
            if hero_id:
                heroes.append(hero_id)
                logger.debug(f"Slot ({x},{y}) -> hero {hero_id} (confidence {confidence:.2f})")
        return heroes

    ally_picks = scan_slots(PICK_SLOTS["radiant"])
    enemy_picks = scan_slots(PICK_SLOTS["dire"])
    bans = scan_slots(BAN_SLOTS["radiant"]) + scan_slots(BAN_SLOTS["dire"])

    return {"ally_picks": ally_picks, "enemy_picks": enemy_picks, "bans": bans}


def report_to_backend(result: dict):
    try:
        resp = requests.post(f"{BACKEND_URL}/api/draft/screen-report", json=result, timeout=5)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Failed to report scan result to backend: {e}")


def main():
    logger.info(f"draft-scanner starting, backend={BACKEND_URL}")
    hero_icons = fetch_hero_icons()
    if not hero_icons:
        logger.error("No hero icons loaded — check backend connectivity, exiting")
        return

    was_active = False
    last_result = None

    while True:
        active = is_draft_active()

        if active and not was_active:
            logger.info("Draft phase detected — starting screen scan")
        if not active and was_active:
            logger.info("Draft phase ended — pausing screen scan")
        was_active = active

        if active:
            result = scan_once(hero_icons)
            if result is not None and result != last_result:
                logger.info(f"Draft state changed: {result}")
                report_to_backend(result)
                last_result = result
            time.sleep(CAPTURE_INTERVAL_S)
        else:
            time.sleep(PHASE_POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
