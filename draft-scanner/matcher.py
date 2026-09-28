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
# every confirmed-empty slot and wrong-hero comparison scored 0-2 in that
# same test. Set comfortably above that noise floor, comfortably below
# the weakest real positive seen so far.
#
# Raised from 5 to 7 after a real, reproducible false positive: ally
# slot 0 consistently matched hero 58 (Enchantress) at score 5 — right
# at the old floor — from the first scan of TWO separate real drafts,
# before any hero was ever actually there, and never changed the entire
# draft. Whatever's rendered in that slot before a pick (very possibly
# a "this is your own slot" UI marker Dota adds only there) apparently
# has just enough incidental texture to clear a bare floor of 5.
MIN_GOOD_MATCHES = 7
_GOOD_MATCH_DISTANCE = 40


def _good_match_count(crop_gray: np.ndarray, ref_gray: np.ndarray) -> int:
    kp1, des1 = _orb.detectAndCompute(crop_gray, None)
    kp2, des2 = _orb.detectAndCompute(ref_gray, None)
    if des1 is None or des2 is None or len(des1) < 2 or len(des2) < 2:
        return 0
    matches = _matcher.match(des1, des2)
    return sum(1 for m in matches if m.distance < _GOOD_MATCH_DISTANCE)


def identify_hero(crop: np.ndarray, hero_icons: dict[int, np.ndarray]) -> tuple[int | None, float, int | None]:
    """Returns (accepted_hero_id, best_count, best_candidate_hero_id).
    accepted_hero_id is None if nothing clears MIN_GOOD_MATCHES;
    best_candidate_hero_id is the top scorer REGARDLESS of the
    threshold, always returned rather than discarded — a below-threshold
    call is exactly as useful to see for diagnosing a wrong detection as
    an accepted one is ("this slot's actual best guess was hero X at a
    score of 3, comfortably below the threshold" is a real, different
    finding than "nothing scored anything at all"). hero_icons should be
    the WIDE portrait crops (see hero_icons.py) — ORB needs real
    texture/detail to find keypoints in, which the small 32x32 icon crop
    doesn't have enough of."""
    if crop.size == 0:
        return None, 0, None

    # Small crops (~150x95) don't give ORB much to work with — upscaling
    # measurably improved keypoint yield in testing.
    crop_big = cv2.resize(crop, (crop.shape[1] * 2, crop.shape[0] * 2))
    crop_gray = cv2.cvtColor(crop_big, cv2.COLOR_BGR2GRAY)

    best_hero_id = None
    best_count = 0
    second_best_count = 0

    for hero_id, icon in hero_icons.items():
        ref_gray = cv2.cvtColor(icon, cv2.COLOR_BGR2GRAY)
        count = _good_match_count(crop_gray, ref_gray)
        if count > best_count:
            second_best_count = best_count
            best_count = count
            best_hero_id = hero_id
        elif count > second_best_count:
            second_best_count = count

    # A real hero portrait wins decisively against every OTHER reference
    # icon too, not just against the empty-slot floor — the validated
    # ground truth cases won by >5x over their own runner-up (Lion: 142
    # vs 1, Lina: 10 vs 2). Incidental background/UI texture producing a
    # false positive (see MIN_GOOD_MATCHES's docstring — the real
    # Enchantress case above) instead tends to score close to several
    # candidates, since it's matching noise rather than one distinctive
    # portrait. Requiring the winner to dominate its own runner-up, not
    # just clear an absolute floor, catches that kind of false positive
    # even if a future one happens to score above the floor.
    accepted = (
        best_hero_id
        if best_count >= MIN_GOOD_MATCHES and best_count >= second_best_count * 2
        else None
    )
    return accepted, best_count, best_hero_id
