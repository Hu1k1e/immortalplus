"""
Downloads and caches one reference portrait image per hero, sourced from
our own backend's /api/meta/hero-list "image" field (the wide splash-art
crop — see backend/utils/dota_constants.py's get_hero_image_url) rather
than duplicating hero data here.

Uses "image" specifically, NOT the list's "icon" field: "icon" is a tiny
32x32 crop with too little texture/detail for the ORB feature matching
matcher.py uses — confirmed directly (see matcher.py's docstring for the
full real-test history: raw pixel template matching against "icon"
failed on real ground-truth picks, and ORB against the larger "image"
crop fixed it decisively).
"""

import logging
import os

import cv2
import numpy as np
import requests

from config import BACKEND_URL, ICON_CACHE_DIR

logger = logging.getLogger("draft-scanner.hero_icons")


def fetch_hero_icons() -> dict[int, np.ndarray]:
    """Returns {hero_id: icon_image (BGR numpy array)}. Downloads once,
    then reuses the on-disk cache on subsequent runs."""
    os.makedirs(ICON_CACHE_DIR, exist_ok=True)

    resp = requests.get(f"{BACKEND_URL}/api/meta/hero-list", timeout=15)
    resp.raise_for_status()
    heroes = resp.json()

    icons: dict[int, np.ndarray] = {}
    for hero in heroes:
        hero_id = hero["hero_id"]
        cache_path = os.path.join(ICON_CACHE_DIR, f"{hero_id}.png")

        if not os.path.exists(cache_path):
            img_resp = requests.get(hero["image"], timeout=15)
            if img_resp.status_code != 200:
                logger.warning(f"Failed to download icon for hero {hero_id} ({hero['name']}): HTTP {img_resp.status_code}")
                continue
            with open(cache_path, "wb") as f:
                f.write(img_resp.content)

        img = cv2.imread(cache_path, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning(f"Failed to decode cached icon for hero {hero_id} ({hero['name']}) — deleting bad cache entry")
            os.remove(cache_path)
            continue
        icons[hero_id] = img

    logger.info(f"Loaded {len(icons)}/{len(heroes)} hero reference icons")
    return icons


def fetch_hero_names() -> dict[int, str]:
    """{hero_id: localized_name} — used by ban_ocr.py to fuzzy-match
    OCR'd ban-log text against real hero names, since the ban log has no
    icons to template-match against (see regions.py's BAN_LOG_REGION
    docstring)."""
    resp = requests.get(f"{BACKEND_URL}/api/meta/hero-list", timeout=15)
    resp.raise_for_status()
    return {hero["hero_id"]: hero["name"] for hero in resp.json()}
