"""
draft-scanner configuration.

BACKEND_URL should point at your running Immortal+ backend (the same one
your GSI config already posts to) — e.g. https://dota.hulksmash.ca or
http://localhost:9487 if running the scanner on the same machine as the
backend (it isn't, normally: this runs on the *gaming* PC).
"""

import os
import sys

BACKEND_URL = os.environ.get("IMMORTALPLUS_BACKEND_URL", "https://dota.hulksmash.ca")

# How often to poll the backend's /api/draft/state for phase changes when
# NOT actively scanning (cheap — just a GET). Once a draft is detected,
# the capture loop itself runs much faster (see main.py CAPTURE_INTERVAL_S).
PHASE_POLL_INTERVAL_S = 2.0

# How often to capture + match the screen once the draft phase is active.
CAPTURE_INTERVAL_S = 1.0

# Match confidence thresholds live next to the matchers that use them —
# matcher.py's MIN_GOOD_MATCHES, ban_ocr.py's fuzzy-match cutoff — since
# they're specific to each matching algorithm's own scoring scale.

# Where cached hero icon reference images are stored after first download.
# Not next to the script: when packaged as a onefile .exe (build.spec),
# that "next to the script" location is a fresh temp dir every single
# run (PyInstaller onefile mode self-extracts and cleans up after exit),
# which would force a full re-download of all ~125 icons on every
# launch. %LOCALAPPDATA% persists across runs like any normal installed
# app's data would.
if getattr(sys, "frozen", False):
    _cache_root = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "draft-scanner")
else:
    _cache_root = os.path.dirname(__file__)
ICON_CACHE_DIR = os.path.join(_cache_root, "icon_cache")
