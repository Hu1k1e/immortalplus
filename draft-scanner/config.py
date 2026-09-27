"""
draft-scanner configuration.

BACKEND_URL should point at your running Immortal+ backend (the same one
your GSI config already posts to) — e.g. https://dota.hulksmash.ca or
http://localhost:9487 if running the scanner on the same machine as the
backend (it isn't, normally: this runs on the *gaming* PC).
"""

import os

BACKEND_URL = os.environ.get("IMMORTALPLUS_BACKEND_URL", "https://dota.hulksmash.ca")

# How often to poll the backend's /api/draft/state for phase changes when
# NOT actively scanning (cheap — just a GET). Once a draft is detected,
# the capture loop itself runs much faster (see main.py CAPTURE_INTERVAL_S).
PHASE_POLL_INTERVAL_S = 2.0

# How often to capture + match the screen once the draft phase is active.
CAPTURE_INTERVAL_S = 1.0

# Minimum template-match confidence (0-1) to accept a hero identification
# for a slot. Tuned conservatively — a missed pick (we just don't update
# yet) is much better than a wrong one (bad suggestions).
MATCH_CONFIDENCE_THRESHOLD = 0.75

# Where cached hero icon reference images are stored after first download.
ICON_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".icon_cache")
