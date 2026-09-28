"""
Identify which hero (if any) occupies a cropped draft-slot region, via
ORB feature matching against reference portraits.

This replaced a naive cv2.matchTemplate approach after real testing
against a ground-truth screenshot (two known picks, confirmed by the
user: Lion and Lina) showed template matching failing badly — both
correct heroes scored near zero and ranked outside the top 20, even
though the reference images were visually right. The root cause:
Dota's in-game draft-slot portrait is cropped/zoomed differently than
Valve's CDN reference image of the same hero, and raw pixel template
matching is too sensitive to that kind of scale/crop mismatch even
between genuinely matching images.

ORB (feature/keypoint matching, designed specifically for "same subject,
different scale/crop/viewpoint") fixed this decisively on the same test:
Lion ranked #1 with 142 good keypoint matches (next-best hero: 1). Lina
ranked #1 with 10 (next-best: 2). Confirmed-empty slots scored 0 against
every hero in the same test — a clean separation between "hero present"
and "nothing here yet".
"""

import cv2
import numpy as np

_orb = cv2.ORB_create(nfeatures=500)
_matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

# Absolute minimum good-keypoint-match count to accept an identification.
# Lina's ground-truth case (the weaker of two real test picks) scored 10;
# every confirmed-empty slot and wrong-hero comparison scored 0-2. Set
# comfortably above the empty-slot noise floor, comfortably below the
# weakest real positive seen so far.
MIN_GOOD_MATCHES = 5
_GOOD_MATCH_DISTANCE = 40


def _good_match_count(crop_gray: np.ndarray, ref_gray: np.ndarray) -> int:
    kp1, des1 = _orb.detectAndCompute(crop_gray, None)
    kp2, des2 = _orb.detectAndCompute(ref_gray, None)
    if des1 is None or des2 is None or len(des1) < 2 or len(des2) < 2:
        return 0
    matches = _matcher.match(des1, des2)
    return sum(1 for m in matches if m.distance < _GOOD_MATCH_DISTANCE)


def identify_hero(crop: np.ndarray, hero_icons: dict[int, np.ndarray]) -> tuple[int | None, float]:
    """Returns (hero_id, match_count) for the best match, or (None, 0) if
    nothing clears MIN_GOOD_MATCHES. hero_icons should be the WIDE
    portrait crops (see hero_icons.py) — ORB needs real texture/detail to
    find keypoints in, which the small 32x32 icon crop doesn't have
    enough of."""
    if crop.size == 0:
        return None, 0

    # Small crops (~150x95) don't give ORB much to work with — upscaling
    # measurably improved keypoint yield in testing.
    crop_big = cv2.resize(crop, (crop.shape[1] * 2, crop.shape[0] * 2))
    crop_gray = cv2.cvtColor(crop_big, cv2.COLOR_BGR2GRAY)

    best_hero_id = None
    best_count = 0

    for hero_id, icon in hero_icons.items():
        ref_gray = cv2.cvtColor(icon, cv2.COLOR_BGR2GRAY)
        count = _good_match_count(crop_gray, ref_gray)
        if count > best_count:
            best_count = count
            best_hero_id = hero_id

    if best_count >= MIN_GOOD_MATCHES:
        return best_hero_id, best_count
    return None, best_count
