"""
Template matching: identify which hero (if any) occupies a cropped screen
region, by comparing it against every cached reference icon.
"""

import cv2
import numpy as np

from config import MATCH_CONFIDENCE_THRESHOLD


def identify_hero(crop: np.ndarray, hero_icons: dict[int, np.ndarray]) -> tuple[int | None, float]:
    """Returns (hero_id, confidence) for the best match, or (None, 0.0) if
    nothing clears MATCH_CONFIDENCE_THRESHOLD. An empty/unfilled slot
    should score low against every hero, which is what makes this usable
    as a "has this slot been picked yet" signal too, not just "which hero"."""
    if crop.size == 0:
        return None, 0.0

    best_hero_id = None
    best_score = 0.0

    for hero_id, icon in hero_icons.items():
        resized_icon = cv2.resize(icon, (crop.shape[1], crop.shape[0]))
        result = cv2.matchTemplate(crop, resized_icon, cv2.TM_CCOEFF_NORMED)
        score = float(result.max())
        if score > best_score:
            best_score = score
            best_hero_id = hero_id

    if best_score >= MATCH_CONFIDENCE_THRESHOLD:
        return best_hero_id, best_score
    return None, best_score
