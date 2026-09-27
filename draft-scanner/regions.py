"""
Pick/ban slot regions on the Dota 2 draft screen, as PERCENTAGES of full
screen width/height — resolution-independent, since Dota's HUD scales
proportionally with resolution at a given aspect ratio.

IMPORTANT — these coordinates are a best-effort placeholder based on the
general, well-known layout of Dota's picking-phase HUD (a horizontal
strip of 10 hero portraits along the top of the screen, Radiant growing
rightward from the left edge, Dire growing leftward from the right edge),
NOT yet verified against a real screenshot. Per this project's own
established rule (see backend/routers/draft.py's docstring history), a
load-bearing technical detail like exact pixel regions should be verified
against real data before being trusted, not guessed from memory.

To calibrate for real: run `python calibrate.py` while a Dota 2 draft
screen is on screen (any mode — the grid doesn't care about game state).
It saves an annotated screenshot with a percentage grid overlaid, so exact
box edges can be read off directly. Update SLOTS below to match, then
re-run calibrate.py to confirm the boxes now land exactly on each hero
portrait.
"""

from dataclasses import dataclass


@dataclass
class Region:
    # All values are fractions (0.0-1.0) of full screen width/height.
    left: float
    top: float
    width: float
    height: float


# 5 Radiant pick slots, left-to-right, then 5 Dire pick slots, left-to-right.
# PLACEHOLDER — needs calibration, see module docstring.
PICK_SLOTS: dict[str, list[Region]] = {
    "radiant": [
        Region(left=0.045 + i * 0.033, top=0.015, width=0.028, height=0.05)
        for i in range(5)
    ],
    "dire": [
        Region(left=0.72 + i * 0.033, top=0.015, width=0.028, height=0.05)
        for i in range(5)
    ],
}

# Ranked All Pick's automatic pre-picking bans, and Captain's Mode's
# player-driven bans, render in a separate (smaller) strip — PLACEHOLDER,
# same calibration caveat as above. 7 slots per side (see
# backend/routers/draft.py's _extract_slots ban0..ban6 comment).
BAN_SLOTS: dict[str, list[Region]] = {
    "radiant": [
        Region(left=0.045 + i * 0.02, top=0.075, width=0.018, height=0.032)
        for i in range(7)
    ],
    "dire": [
        Region(left=0.66 + i * 0.02, top=0.075, width=0.018, height=0.032)
        for i in range(7)
    ],
}


def to_pixels(region: Region, screen_w: int, screen_h: int) -> tuple[int, int, int, int]:
    """Returns (x, y, w, h) in real pixels for a given captured screen size."""
    return (
        int(region.left * screen_w),
        int(region.top * screen_h),
        int(region.width * screen_w),
        int(region.height * screen_h),
    )
