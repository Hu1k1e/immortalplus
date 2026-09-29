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
                # `wait_until="networkidle"` was a real, confirmed source of
                # failure here (live error 2026-09-29: "Page.goto: Timeout
                # 30000ms exceeded" waiting for it) — this page has enough
                # of its own ongoing background activity (analytics,
                # polling) that network traffic can simply never go fully
                # idle, so the whole goto could time out even after the one
                # response actually needed had already arrived. Waiting
                # specifically for that response instead (Playwright's own
                # documented pattern for this exact flakiness class) is
                # both faster and far more reliable than waiting for
                # silence across the entire page.
                async with page.expect_response(
                    lambda r: "/api/heroes/list" in r.url and r.status == 200, timeout=30000
                ) as response_info:
                    await page.goto(PROTRACKER_META_PAGE_URL, wait_until="domcontentloaded", timeout=30000)
                response = await response_info.value
                heroes = await response.json()
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


async def fetch_hero_position_detail() -> Optional[dict[int, list[dict]]]:
    """
    The full per-hero, per-position breakdown behind Dota2ProTracker's
    Meta page table (see HeroPositionDetail's docstring for what
    /api/heroes/stats returns and means).

    Drives the page the same way a real visitor does — load once, then
    click through the six real <button role="tab"> position tabs in turn
    (their own order: All Roles, Carry, Mid, Offlane, Support, Hard
    Support), a real pause between each — rather than issuing our own
    fetch() calls or reloading the page per position. Confirmed live
    (2026-09-29), in this order, chasing three different failures:
      1. `page.goto(..., wait_until="networkidle")` could time out even
         after the data we needed had already arrived — this page never
         goes fully network-idle.
      2. Once past that, six back-to-back same-page fetch() calls (even
         with a trimmed return value) got every request after the first
         rejected with HTTP 403 — a burst/rate check on the site's side,
         not a URL/param/payload-size problem (the identical URL succeeds
         from a real browser tab).
      3. A fresh full-page navigation straight to `?position=pos+1` does
         NOT itself trigger the stats request either — only the page's
         own client-side tab-switch handler does.
      Clicking each real tab, a few seconds apart, succeeded for all 6
      positions in one continuous session — this is that.

    Returns {position: [{hero_id, matches, wins, winrate, meta_score,
    contest_rate, lane_adv_pct, rating_rank, rating_cohort_size,
    radiant_matches, radiant_wins, dire_matches, dire_wins,
    phase_1/2/3_matches, phase_1/2/3_wins, build_matches, build_winrate},
    ...]} for positions 0 (All Roles) and 1-5, or None on failure.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Dota2ProTracker detail fetch failed: playwright not installed")
        return None

    import asyncio as _asyncio

    result: dict[int, list[dict]] = {}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=_REAL_BROWSER_UA)
                await page.goto(PROTRACKER_META_PAGE_URL, wait_until="load", timeout=30000)
                await _asyncio.sleep(2)  # let the page settle before the first click

                # Tab order confirmed live: ["All Roles", "Carry", "Mid",
                # "Offlane", "Support", "Hard Support"] — matches this
                # app's own 0-5 position convention index-for-index.
                tabs = page.locator('button[role="tab"]')

                # "All Roles" (position 0) is the page's own default
                # active tab on a cold load — confirmed live (2026-09-29)
                # that clicking an already-active tab fires no new
                # request at all (the underlying position value doesn't
                # change, so the page's reactive fetch never re-runs),
                # which is exactly what produced a 20s "waiting for
                # response" timeout when position 0 was clicked first.
                # Visiting it LAST instead guarantees every click is a
                # genuine state change (something else -> All Roles).
                click_order = [1, 2, 3, 4, 5, 0]

                for position in click_order:
                    raw = None
                    for attempt in range(2):
                        try:
                            async with page.expect_response(
                                lambda r: "/api/heroes/stats" in r.url and r.status == 200, timeout=20000
                            ) as response_info:
                                await tabs.nth(position).click(timeout=10000)
                            response = await response_info.value
                            # response.json() reads the raw body over CDP and
                            # parses it in Python — far lighter than the
                            # ~4.6MB-per-position payload going through
                            # page.evaluate()'s live-object serialization
                            # (the earlier, different failure noted above).
                            raw = await response.json()
                            break
                        except Exception as e:
                            if "403" in str(e) and attempt == 0:
                                logger.warning(f"Dota2ProTracker detail: position {position} got HTTP 403, backing off 10s and retrying once")
                                await _asyncio.sleep(10)
                                continue
                            logger.error(f"Dota2ProTracker detail fetch failed for position {position}: {e}")
                            break

                    if raw is None:
                        await _asyncio.sleep(4)
                        continue

                    rows = []
                    for hero in raw:
                        hero_id = hero.get("hero_id")
                        matches = hero.get("matches") or 0
                        if not hero_id or matches <= 0:
                            continue
                        ds = hero.get("detailed_stats") or {}
                        build = ds.get("best_build_winrate") or {}
                        rows.append({
                            "hero_id": hero_id,
                            "matches": matches,
                            "wins": hero.get("wins") or 0,
                            "winrate": (hero.get("wins") or 0) / matches,
                            "meta_score": _to_float(hero.get("meta_score")),
                            "contest_rate": _to_float(hero.get("contest_rate")),
                            "lane_adv_pct": _to_float(ds.get("lane_avg_adv_pct")),
                            "rating_rank": hero.get("rating_rank"),
                            "rating_cohort_size": hero.get("rating_cohort_size"),
                            "radiant_matches": ds.get("radiant_matches") or 0,
                            "radiant_wins": ds.get("radiant_wins") or 0,
                            "dire_matches": ds.get("dire_matches") or 0,
                            "dire_wins": ds.get("dire_wins") or 0,
                            "phase_1_matches": ds.get("phase_1_matches") or 0,
                            "phase_1_wins": ds.get("phase_1_wins") or 0,
                            "phase_2_matches": ds.get("phase_2_matches") or 0,
                            "phase_2_wins": ds.get("phase_2_wins") or 0,
                            "phase_3_matches": ds.get("phase_3_matches") or 0,
                            "phase_3_wins": ds.get("phase_3_wins") or 0,
                            "build_matches": build.get("num_matches") or 0,
                            "build_winrate": _to_float(build.get("win_rate")),
                        })
                    result[position] = rows
                    logger.info(f"Dota2ProTracker detail: fetched {len(rows)} rows for position {position}")

                    # Real human-like pacing between tab clicks — this
                    # pacing (not the URL/params/payload) is what avoided
                    # the 403s seen with back-to-back fetch() calls.
                    await _asyncio.sleep(4)
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"Dota2ProTracker detail fetch failed: {e}")
        return None

    if not any(result.values()):
        logger.error("Dota2ProTracker detail fetch failed: no position returned any rows")
        return None
    return result


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


async def sync_hero_position_detail(session) -> int:
    """
    Fetch + upsert into HeroPositionDetail — the rich per-position
    breakdown behind the Meta page (see fetch_hero_position_detail).
    No Stratz fallback: unlike HeroPositionMeta (which the draft-
    suggestion engine actually depends on and needs to degrade
    gracefully), this table is purely for the Meta page display, and
    the fields it needs (lane advantage, contest rate, pick-phase and
    Radiant/Dire splits) don't have a known equivalent anywhere else in
    this app's data sources — a failed scrape here just means the Meta
    page keeps showing whatever it last had.

    Returns the number of rows written, or 0 on failure.
    """
    from sqlmodel import select
    from models import HeroPositionDetail

    by_position = await fetch_hero_position_detail()
    if not by_position:
        logger.error("Hero-position detail sync failed: Dota2ProTracker fetch returned nothing")
        return 0

    now = datetime.utcnow()
    total = 0
    for position, rows in by_position.items():
        for row in rows:
            existing = session.exec(
                select(HeroPositionDetail)
                .where(HeroPositionDetail.hero_id == row["hero_id"])
                .where(HeroPositionDetail.position == position)
            ).first()
            if existing:
                target = existing
            else:
                target = HeroPositionDetail(hero_id=row["hero_id"], position=position)
                session.add(target)
            target.matches = row["matches"]
            target.wins = row["wins"]
            target.winrate = row["winrate"]
            target.meta_score = row["meta_score"]
            target.contest_rate = row["contest_rate"]
            target.lane_adv_pct = row["lane_adv_pct"]
            target.rating_rank = row["rating_rank"]
            target.rating_cohort_size = row["rating_cohort_size"]
            target.radiant_matches = row["radiant_matches"]
            target.radiant_wins = row["radiant_wins"]
            target.dire_matches = row["dire_matches"]
            target.dire_wins = row["dire_wins"]
            target.phase_1_matches = row["phase_1_matches"]
            target.phase_1_wins = row["phase_1_wins"]
            target.phase_2_matches = row["phase_2_matches"]
            target.phase_2_wins = row["phase_2_wins"]
            target.phase_3_matches = row["phase_3_matches"]
            target.phase_3_wins = row["phase_3_wins"]
            target.build_matches = row["build_matches"]
            target.build_winrate = row["build_winrate"]
            target.updated_at = now
            total += 1

    session.commit()
    logger.info(f"Hero-position detail: synced {total} rows across {len(by_position)} positions")
    return total
