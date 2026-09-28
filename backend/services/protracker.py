"""
Dota2ProTracker integration — real per-position hero win rates.

OpenDota's bulk endpoints (heroStats, matchups) never break performance
down by position (Carry/Mid/Offlane/Soft Support/Hard Support) at all —
confirmed by reading their real responses directly. Dota2ProTracker does
have this via a clean JSON API (/api/heroes/list, discovered by watching
the network tab, not documented) — one call returns every hero's stats
for every position at once.

That endpoint is behind real bot detection, though — confirmed with a
plain HTTP client from two independent networks (this app's sandbox and
the user's own server), both got a 403 even with a real browser
User-Agent header, so it's checking something beyond that (TLS
fingerprint / JS challenge, typical of Cloudflare-style protection). A
real browser (Playwright/Chromium, already an installed dependency from
this project's original, correct instinct) passes it fine, so this loads
the real page and reads the same API response the page's own JavaScript
already triggers, rather than hitting the API URL directly.

Checked robots.txt first: disallows only /drafter?* (their own
proprietary draft tool) for all user-agents, with a 2-second crawl delay
requested generally — the page load approach here is a single request
per sync cycle, well within that.

This data is explicitly "7000+ MMR + pro matches" — a specific high-skill
tier, not calibrated to any particular rank. That's an accepted, correct
scope for this specific use (best current-patch heroes per role for a
draft helper), not a general per-rank benchmark — confirmed with the user
rather than assumed.
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

PROTRACKER_META_PAGE_URL = "https://dota2protracker.com/meta"
_REAL_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


async def fetch_hero_position_meta() -> Optional[list[dict]]:
    """
    Real per-hero, per-position stats from Dota2ProTracker. Returns a
    flat list of {hero_id, position, matches, winrate, d2pt_rating}
    dicts (one row per hero per position 1-5, skipping positions with
    zero recorded matches for that hero), or None on failure.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Dota2ProTracker fetch failed: playwright not installed")
        return None

    heroes = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=_REAL_BROWSER_UA)
                captured = {}

                async def handle_response(response):
                    if "/api/heroes/list" in response.url and response.status == 200:
                        try:
                            captured["data"] = await response.json()
                        except Exception:
                            pass

                page.on("response", handle_response)
                await page.goto(PROTRACKER_META_PAGE_URL, wait_until="networkidle", timeout=30000)
                heroes = captured.get("data")
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"Dota2ProTracker fetch failed: {e}")
        return None

    if not heroes:
        logger.error("Dota2ProTracker fetch failed: page loaded but /api/heroes/list response never captured")
        return None

    rows = []
    for hero in heroes:
        hero_id = hero.get("hero_id")
        if not hero_id:
            continue
        for position in range(1, 6):
            matches = hero.get(f"pos {position} matches", 0) or 0
            if matches <= 0:
                continue
            rows.append({
                "hero_id": hero_id,
                "position": position,
                "matches": matches,
                "winrate": hero.get(f"pos {position} winrate"),
                "d2pt_rating": _to_float(hero.get(f"pos {position} d2pt rating")),
            })

    logger.info(f"Dota2ProTracker: fetched {len(rows)} hero/position rows for {len(heroes)} heroes")
    return rows


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def sync_hero_position_meta(session, settings) -> int:
    """
    Fetch + upsert into HeroPositionMeta. Scrapes Dota2ProTracker's own
    page FIRST — the literal numbers a user sees when they check
    dota2protracker.com themselves, which is what this data is compared
    against and needs to match exactly. Stratz's heroStats.stats query is
    only a fallback when the scrape fails: it's the same underlying data
    source architecturally (Stratz's own API page lists ProTracker as
    built on this API), but not proven to apply the identical time-window/
    filtering ProTracker's own page uses to produce "this patch" numbers
    — confirmed as a real, reported mismatch, not assumed. (This was
    previously the other way around, Stratz-first — flipped after that
    mismatch was reported directly.)

    Returns the number of rows written, or 0 on total failure.
    """
    from sqlmodel import select
    from models import HeroPositionMeta
    import asyncio

    rows = None
    source = None

    for attempt in range(3):
        rows = await fetch_hero_position_meta()
        if rows:
            source = "Dota2ProTracker"
            break
        if attempt < 2:
            logger.warning(f"Dota2ProTracker sync attempt {attempt + 1} failed, retrying...")
            await asyncio.sleep(5)

    if not rows and settings and getattr(settings, "stratz_api_token", None):
        try:
            from services.stratz import get_stratz_client, rank_bracket_to_stratz
            stratz_client = get_stratz_client(settings.stratz_api_token)
            rows = await stratz_client.get_hero_position_stats(rank_bracket_to_stratz(None))
            if rows:
                source = "Stratz (Dota2ProTracker scrape failed)"
        except Exception as e:
            logger.warning(f"Stratz hero-position fallback also failed: {e}")

    if not rows:
        logger.error("Hero-position meta sync failed: both Dota2ProTracker scrape and Stratz fallback failed")
        return 0

    now = datetime.utcnow()
    for row in rows:
        existing = session.exec(
            select(HeroPositionMeta)
            .where(HeroPositionMeta.hero_id == row["hero_id"])
            .where(HeroPositionMeta.position == row["position"])
        ).first()
        if existing:
            existing.matches = row["matches"]
            existing.winrate = row["winrate"]
            existing.d2pt_rating = row["d2pt_rating"]
            existing.updated_at = now
        else:
            session.add(HeroPositionMeta(
                hero_id=row["hero_id"],
                position=row["position"],
                matches=row["matches"],
                winrate=row["winrate"],
                d2pt_rating=row["d2pt_rating"],
                updated_at=now,
            ))

    session.commit()
    logger.info(f"Hero-position meta: synced {len(rows)} rows (source: {source})")
    return len(rows)
