"""
Calibration helper — run this while a Dota 2 draft screen is visible
(any game mode). Captures the actual Dota 2 window (found by title, not
"whatever's on the primary monitor" — see window_capture.py), and saves
three files next to this script:

  calibration_raw.png   — the plain capture
  calibration_grid.png  — the same capture with a 5% percentage grid
                          overlaid, labeled on each axis
  regions_preview.png   — the current regions.py boxes drawn on top

Use calibration_grid.png to read off the exact left/top/width/height
(as fractions of the GAME WINDOW, not the monitor) for each hero portrait
slot, then update PICK_SLOTS / BAN_SLOTS in regions.py to match. Re-run
this script afterwards and check regions_preview.png to confirm the
boxes now land exactly on each portrait.
"""

import time

import cv2
import numpy as np

from regions import PICK_SLOTS, BAN_SLOTS, to_pixels
from window_capture import capture_dota_window, capture_primary_monitor


def draw_grid(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    h, w = out.shape[:2]
    for pct in range(0, 101, 5):
        x = int(w * pct / 100)
        y = int(h * pct / 100)
        cv2.line(out, (x, 0), (x, h), (0, 255, 0), 1)
        cv2.line(out, (0, y), (w, y), (0, 255, 0), 1)
        cv2.putText(out, f"{pct}%", (x + 2, 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        cv2.putText(out, f"{pct}%", (2, y + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
    return out


def draw_regions_preview(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    h, w = out.shape[:2]
    for side, slots in {**PICK_SLOTS, **{f"ban_{k}": v for k, v in BAN_SLOTS.items()}}.items():
        for region in slots:
            x, y, rw, rh = to_pixels(region, w, h)
            cv2.rectangle(out, (x, y), (x + rw, y + rh), (0, 0, 255), 2)
    return out


if __name__ == "__main__":
    print("Capturing in 3 seconds — switch to the Dota 2 draft screen now...")
    time.sleep(3)

    shot = capture_dota_window()
    if shot is None:
        print("WARNING: Dota 2 window not found — falling back to primary monitor capture.")
        print("This will only be useful for testing the grid, NOT for real calibration —")
        print("make sure Dota 2 is actually running (windowed or borderless, not exclusive")
        print("fullscreen also works since Windows still tracks its window rect) and retry.")
        shot = capture_primary_monitor()
    else:
        print(f"Captured Dota 2 window: {shot.shape[1]}x{shot.shape[0]}")

    cv2.imwrite("calibration_raw.png", shot)
    cv2.imwrite("calibration_grid.png", draw_grid(shot))
    cv2.imwrite("regions_preview.png", draw_regions_preview(shot))
    print("Saved calibration_raw.png, calibration_grid.png, and regions_preview.png")
    print("Check regions_preview.png: red boxes should land exactly on each hero portrait slot.")
    print("If not, use calibration_grid.png to read off correct percentages and update regions.py.")
