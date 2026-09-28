"""
Ranked All Pick's auto-bans render as plain scrolling text in the chat
log ("Phantom Assassin has been Banned.") rather than a row of hero-icon
slots the way Captain's Mode's bans do — confirmed from a real capture
(see regions.py's BAN_LOG_REGION docstring). So instead of template
matching, this reads the text with OCR and fuzzy-matches each extracted
name against the real hero list, tolerating OCR's occasional misreads.

Requires the Tesseract OCR engine installed separately from its Python
wrapper (pytesseract only calls out to it) — see README.md for the
Windows install step.

Doesn't rely on PATH to find it: Windows installers (including the
Chocolatey package) frequently write the PATH entry but new shells
still don't pick it up until a full logoff/reboot — confirmed hitting
this directly during setup even right after a successful install. Since
the actual exe lands in one of a couple of predictable locations
regardless, check those directly instead of making every user fight
their PATH.

The packaged .exe (see build.spec) bundles its own copy of Tesseract
instead of depending on a system install at all — end users shouldn't
need to install anything separately. That bundled copy is checked first.
"""

import difflib
import logging
import os
import re
import shutil
import sys

import numpy as np

logger = logging.getLogger("draft-scanner.ban_ocr")

_BAN_LINE_RE = re.compile(r"(.+?)\s+has\s+been\s+banned\.?", re.IGNORECASE)

_KNOWN_INSTALL_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _bundled_tesseract_path() -> str | None:
    """Path to the copy bundled inside the packaged .exe (build.spec),
    when running as that .exe rather than as a plain Python script."""
    if not getattr(sys, "frozen", False):
        return None
    bundle_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    path = os.path.join(bundle_dir, "Tesseract-OCR", "tesseract.exe")
    return path if os.path.exists(path) else None


_tesseract_path_configured = False


def _configure_tesseract_path():
    global _tesseract_path_configured
    if _tesseract_path_configured:
        return
    _tesseract_path_configured = True

    import pytesseract

    bundled = _bundled_tesseract_path()
    if bundled:
        pytesseract.pytesseract.tesseract_cmd = bundled
        # Tesseract needs to find its trained-language data (tessdata/) —
        # it looks relative to the exe by default, but be explicit rather
        # than rely on that, since TESSDATA_PREFIX is what it actually
        # checks first.
        os.environ["TESSDATA_PREFIX"] = os.path.join(os.path.dirname(bundled), "tessdata")
        logger.info(f"Using bundled Tesseract at {bundled}")
        return

    if shutil.which("tesseract"):
        return  # already on PATH, nothing to do
    for path in _KNOWN_INSTALL_PATHS:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            logger.info(f"Found Tesseract at {path} (not on PATH — using directly)")
            return
    logger.warning(
        "Tesseract not found on PATH or in standard install locations — "
        "ban OCR will fail until it's installed (see README.md)"
    )


def extract_banned_hero_ids(crop: np.ndarray, hero_names: dict[int, str]) -> list[int]:
    """Returns hero_ids for every "<hero> has been Banned." line found in
    the cropped ban-log region, fuzzy-matched against hero_names. Skips
    any OCR'd name that doesn't clear a reasonable similarity threshold
    rather than guessing — a missed ban is far better than excluding the
    wrong hero from suggestions."""
    try:
        import pytesseract
    except ImportError:
        logger.error("Ban OCR failed: pytesseract not installed (pip install -r requirements.txt)")
        return []

    _configure_tesseract_path()

    try:
        text = pytesseract.image_to_string(crop)
    except Exception as e:
        logger.error(
            f"Ban OCR failed: {e} — is the Tesseract engine installed and on PATH? "
            f"(pytesseract is just a wrapper around it, see README.md)"
        )
        return []

    name_to_id = {name.lower(): hero_id for hero_id, name in hero_names.items()}
    all_names_lower = list(name_to_id.keys())

    banned_ids = []
    for line in text.splitlines():
        match = _BAN_LINE_RE.search(line.strip())
        if not match:
            continue
        ocr_name = match.group(1).strip().lower()

        best = difflib.get_close_matches(ocr_name, all_names_lower, n=1, cutoff=0.75)
        if best:
            hero_id = name_to_id[best[0]]
            if hero_id not in banned_ids:
                banned_ids.append(hero_id)
        else:
            logger.debug(f"Ban OCR: no confident hero match for OCR'd text '{ocr_name}'")

    return banned_ids
