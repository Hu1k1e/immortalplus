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

from ban_ocr import extract_banned_hero_ids
from config import BACKEND_URL, PHASE_POLL_INTERVAL_S, CAPTURE_INTERVAL_S
from hero_icons import fetch_hero_icons, fetch_hero_names
from matcher import identify_hero
from regions import PICK_SLOTS, BAN_LOG_REGION, to_pixels
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


def scan_once(hero_icons: dict, hero_names: dict) -> dict | None:
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

    x, y, rw, rh = to_pixels(BAN_LOG_REGION, w, h)
    ban_crop = screen[y:y + rh, x:x + rw]
    bans = extract_banned_hero_ids(ban_crop, hero_names)

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
    hero_names = fetch_hero_names()
    if not hero_icons:
        logger.error("No hero icons loaded — check backend connectivity, exiting")
        return

    was_active = False
    # Accumulated, never-shrinking within a single draft: a pick, once
    # locked in, and a ban, once announced, never reverses — so a single
    # flaky OCR/match pass missing something it caught a moment ago
    # should never un-report it and let a banned hero back into
    # suggestions mid-draft.
    seen_ally_picks: set[int] = set()
    seen_enemy_picks: set[int] = set()
    seen_bans: set[int] = set()
    last_reported = None

    while True:
        active = is_draft_active()

        if active and not was_active:
            logger.info("Draft phase detected — starting screen scan")
        if not active and was_active:
            logger.info("Draft phase ended — pausing screen scan")
            seen_ally_picks.clear()
            seen_enemy_picks.clear()
            seen_bans.clear()
            last_reported = None
        was_active = active

        if active:
            result = scan_once(hero_icons, hero_names)
            if result is not None:
                seen_ally_picks.update(result["ally_picks"])
                seen_enemy_picks.update(result["enemy_picks"])
                seen_bans.update(result["bans"])

                accumulated = {
                    "ally_picks": sorted(seen_ally_picks),
                    "enemy_picks": sorted(seen_enemy_picks),
                    "bans": sorted(seen_bans),
                }
                if accumulated != last_reported:
                    logger.info(f"Draft state changed: {accumulated}")
                    report_to_backend(accumulated)
                    last_reported = accumulated
            time.sleep(CAPTURE_INTERVAL_S)
        else:
            time.sleep(PHASE_POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
