"""
Screen regions on the Dota 2 draft screen, as PERCENTAGES of the captured
Dota 2 window's width/height (window-relative, not monitor-relative —
see window_capture.py) — resolution-independent, since Dota's HUD scales
proportionally with window size at a given aspect ratio.

PICK_SLOTS was measured directly, pixel-by-pixel, from a real 2560x1440
Ranked All Pick capture (calibrate.py output, All Pick lobby, 2026-09-27)
— not guessed. Each of the 10 portrait slots was located by cropping the
top HUD strip and reading exact box edges off the crop.

BAN_LOG_REGION replaces an earlier, WRONG assumption that bans render as
a row of hero-portrait icons the same way picks do (mirroring Captain's
Mode's ban strip). The real capture showed no such strip: Ranked All
Pick's auto-bans instead appear as plain scrolling text in the chat/log
panel ("Phantom Assassin has been Banned."), so ban detection uses OCR
text parsing (see ban_ocr.py) over this one region instead of per-slot
icon template matching.
"""

from dataclasses import dataclass


@dataclass
class Region:
    # All values are fractions (0.0-1.0) of the captured Dota window's
    # width/height.
    left: float
    top: float
    width: float
    height: float


# 5 Radiant pick slots, left-to-right, then 5 Dire pick slots, left-to-right.
# Measured from a real 2560x1440 capture: each portrait box is ~6.0% of
# window width, spaced ~6.5% apart (i.e. a ~0.5% gap between boxes),
# starting at 11.48% from the left edge (Radiant) / 58.25% (Dire).
PICK_SLOTS: dict[str, list[Region]] = {
    "radiant": [
        Region(left=0.1148 + i * 0.065, top=0.004, width=0.060, height=0.067)
        for i in range(5)
    ],
    "dire": [
        Region(left=0.5825 + i * 0.065, top=0.004, width=0.060, height=0.067)
        for i in range(5)
    ],
}

# One region covering the scrolling ban-announcement text log (bottom-
# right chat/log panel) — generous on purpose since OCR tolerates an
# imprecise crop far better than icon template matching does. Measured
# from the same real capture: roughly spans the log box between the
# "LOCK IN"/hero-info panel above and the chat input box below.
BAN_LOG_REGION = Region(left=0.60, top=0.79, width=0.30, height=0.17)


def to_pixels(region: Region, screen_w: int, screen_h: int) -> tuple[int, int, int, int]:
    """Returns (x, y, w, h) in real pixels for a given captured window size."""
    return (
        int(region.left * screen_w),
        int(region.top * screen_h),
        int(region.width * screen_w),
        int(region.height * screen_h),
    )
