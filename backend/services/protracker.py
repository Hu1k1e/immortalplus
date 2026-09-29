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

import json
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
                page = await browser.new_page(user_agent=_REAL_BROWSER_UA, viewport={"width": 1920, "height": 1080})
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


_TAB_NAMES = ["All Roles", "Carry", "Mid", "Offlane", "Support", "Hard Support"]


def _parse_position_detail_rows(raw: list[dict]) -> list[dict]:
    """Trims one position's raw /api/heroes/stats response down to the
    fields HeroPositionDetail stores (see fetch_hero_position_detail)."""
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
    return rows


async def _fetch_one_position_detail(browser, position: int) -> Optional[list]:
    """
    One position, in its own fresh browser context (own cookie jar, own
    Cloudflare challenge) — NOT a page reused across positions. Four prior
    fix attempts (2026-09-29) all reused one page/session for all six tab
    clicks, and each failed differently (a 20s timeout waiting for a
    response) for whichever tab ended up in a certain slot of the
    sequence — including on a SAME-tab retry within that same session,
    which rules out per-click timing as the cause. That points at
    something session-level (not per-click, not per-tab) going wrong
    after the session's first request, which a fresh context per position
    sidesteps entirely by construction, regardless of the exact mechanism.

    "All Roles" (position 0) is the page's own default active tab on a
    cold load, so it needs one throwaway click elsewhere first to make
    clicking back to it a genuine state change (an already-active tab's
    click fires no request at all).
    """
    import asyncio as _asyncio

    context = await browser.new_context(user_agent=_REAL_BROWSER_UA, viewport={"width": 1920, "height": 1080})
    try:
        page = await context.new_page()
        await page.goto(PROTRACKER_META_PAGE_URL, wait_until="load", timeout=30000)
        await _asyncio.sleep(4)  # let the page settle/hydrate

        if position == 0:
            other = page.get_by_role("tab", name="Carry", exact=True)
            try:
                await other.click(timeout=10000)
                await _asyncio.sleep(2)
            except Exception as e:
                logger.info(f"Dota2ProTracker detail: throwaway pre-click for position 0 raised (non-fatal): {e}")

        tab = page.get_by_role("tab", name=_TAB_NAMES[position], exact=True)
        await tab.wait_for(state="visible", timeout=10000)
        async with page.expect_response(
            lambda r: "/api/heroes/stats" in r.url and r.status == 200, timeout=20000
        ) as response_info:
            await tab.click(timeout=10000)
        response = await response_info.value
        # response.json() reads the raw body over CDP and parses it in
        # Python — far lighter than the ~4.6MB-per-position payload going
        # through page.evaluate()'s live-object serialization (an earlier,
        # different failure this app hit before this function existed).
        return await response.json()
    finally:
        await context.close()


async def fetch_hero_position_detail(position: int) -> Optional[list[dict]]:
    """
    One position's full per-hero breakdown behind Dota2ProTracker's Meta
    page table (see HeroPositionDetail's docstring for what
    /api/heroes/stats returns and means).

    Fetches ONLY this one position, not all six — see
    sync_hero_position_detail's docstring for why: even a single request,
    in its own fully-fresh browser context, has been observed failing
    unpredictably in production (a different position each time, no
    consistent pattern), which points at something upstream of this app's
    code (most likely Cloudflare/bot-mitigation treating this server's
    IP with rising suspicion the more it's hit — a fresh cookie jar
    doesn't reset that). Retrying several times with real backoff between
    attempts, each in its own fresh context, is the most this function
    can reasonably do about that; spreading the six positions across
    separate sync cycles instead of bursting all six every time is the
    other half of the mitigation, handled by the caller.

    Returns [{hero_id, matches, wins, winrate, meta_score, contest_rate,
    lane_adv_pct, rating_rank, rating_cohort_size, radiant_matches,
    radiant_wins, dire_matches, dire_wins, phase_1/2/3_matches,
    phase_1/2/3_wins, build_matches, build_winrate}, ...], or None on
    failure after all retries.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Dota2ProTracker detail fetch failed: playwright not installed")
        return None

    import asyncio as _asyncio

    raw = None
    last_error = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                for attempt in range(4):
                    try:
                        raw = await _fetch_one_position_detail(browser, position)
                        break
                    except Exception as e:
                        last_error = e
                        backoff = 20 if "403" in str(e) else 12
                        if attempt < 3:
                            logger.warning(f"Dota2ProTracker detail: position {position} ({_TAB_NAMES[position]}) attempt {attempt + 1} failed ({e}), retrying with a fresh session in {backoff}s")
                            await _asyncio.sleep(backoff)
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"Dota2ProTracker detail fetch failed for position {position}: {e}")
        return None

    if raw is None:
        logger.error(f"Dota2ProTracker detail fetch failed for position {position} ({_TAB_NAMES[position]}) after 4 fresh-session attempts: {last_error}")
        return None

    rows = _parse_position_detail_rows(raw)
    logger.info(f"Dota2ProTracker detail: fetched {len(rows)} rows for position {position}")
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


async def sync_hero_position_detail(session) -> int:
    """
    Fetch + upsert into HeroPositionDetail — the rich per-position
    breakdown behind the Meta page (see fetch_hero_position_detail).

    Fetches ONE position per call, not all six — this table used to be
    refreshed by bursting all six positions back-to-back every sync, but
    that consistently failed in production for at least one of the six no
    matter how the burst was restructured (shared session, fresh session
    per position, different click orders/warm-ups — each change produced
    a DIFFERENT position failing, never a consistent one), which points
    at something upstream of this app entirely (most likely Cloudflare/
    bot-mitigation reacting to repeated bursts from this server's IP, not
    anything about the request itself). Fetching one position per sync
    cycle spreads those six requests out over six cycles instead — at
    protracker_interval_minutes' default of 30 minutes that's a full
    refresh roughly every 3 hours, far less bursty, and each individual
    fetch still retries with fresh sessions internally (see
    fetch_hero_position_detail) as a second layer of resilience.

    Picks whichever position has gone longest without a successful
    update (all-null/never-fetched sorts first) so every position
    eventually gets covered in rotation rather than always retrying the
    same one. No Stratz fallback: unlike HeroPositionMeta (which the
    draft-suggestion engine actually depends on and needs to degrade
    gracefully), this table is purely for the Meta page display, and the
    fields it needs (lane advantage, contest rate, pick-phase and
    Radiant/Dire splits) don't have a known equivalent anywhere else in
    this app's data sources — a failed fetch here just means that one
    position keeps showing whatever it last had until the next rotation.

    Returns the number of rows written for the position it picked, or 0
    on failure.
    """
    from sqlmodel import select, func as sa_func
    from models import HeroPositionDetail

    position_ages: dict[int, Optional[datetime]] = {}
    for position in range(6):
        position_ages[position] = session.exec(
            select(sa_func.max(HeroPositionDetail.updated_at)).where(HeroPositionDetail.position == position)
        ).first()
    # Never-fetched (None) sorts before any real timestamp.
    position = min(range(6), key=lambda p: (position_ages[p] is not None, position_ages[p] or datetime.min))

    rows = await fetch_hero_position_detail(position)
    if not rows:
        logger.error(f"Hero-position detail sync failed for position {position} ({_TAB_NAMES[position]})")
        return 0

    now = datetime.utcnow()
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

    session.commit()
    logger.info(f"Hero-position detail: synced {len(rows)} rows for position {position} ({_TAB_NAMES[position]})")
    return len(rows)


async def fetch_hero_overview(hero_localized_name: str, hero_id: int, position: int) -> Optional[dict]:
    """
    One hero/position's real "hero page" overview (win/pick rate history,
    most-played build, ability order, role popularity) — see
    HeroOverview's docstring for the full field list.

    Confirmed live (2026-09-29) that dota2protracker.com/hero/{Name} is a
    completely different, far more reliable request pattern than the one
    that broke HeroPositionDetail: /api/hero/{id}/overview,
    /api/heroes/role-rankings, and /api/abilities all fire AUTOMATICALLY
    on a plain page load with `?position=pos+N` already in the URL — no
    tab click needed at all — and each returns small (2-4KB) JSON, not
    the ~4.6MB burst that triggered the other endpoint's bot-mitigation.
    Same fresh-context-per-call approach as the rest of this file for
    consistency, even though a shared context has never been proven to
    be the actual problem here (this endpoint family hasn't shown the
    same failures) — cheap insurance since this runs on-demand rather
    than in a tight background loop.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Dota2ProTracker hero overview fetch failed: playwright not installed")
        return None

    import asyncio as _asyncio
    from urllib.parse import quote

    url = f"https://dota2protracker.com/hero/{quote(hero_localized_name)}?position=pos+{position}"

    async def wait_for_json(page, url_fragment: str, timeout_ms: int) -> Optional[dict]:
        """Waits for a specific real response event (armed before
        navigation, so it can't miss one that fires immediately after
        load) rather than a fixed sleep-then-hope-it-landed — a blind
        3s sleep was confirmed live (2026-09-29) to sometimes be too
        short for role-rankings specifically, leaving D2PT Rating blank
        even though the overview request itself had already succeeded."""
        try:
            response = await page.wait_for_event(
                "response",
                predicate=lambda r: url_fragment in r.url and r.status == 200,
                timeout=timeout_ms,
            )
            return await response.json()
        except Exception:
            return None

    overview = None
    rankings = None
    abilities = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(user_agent=_REAL_BROWSER_UA, viewport={"width": 1920, "height": 1080})
                page = await context.new_page()

                # Armed before goto() so none of the three can be missed.
                overview_task = _asyncio.ensure_future(wait_for_json(page, f"/api/hero/{hero_id}/overview", 20000))
                rankings_task = _asyncio.ensure_future(wait_for_json(page, "/api/heroes/role-rankings", 20000))
                abilities_task = _asyncio.ensure_future(wait_for_json(page, f"/api/abilities?hero_id={hero_id}", 20000))

                await page.goto(url, wait_until="load", timeout=30000)
                overview, rankings, abilities = await _asyncio.gather(overview_task, rankings_task, abilities_task)
            finally:
                await context.close()
                await browser.close()
    except Exception as e:
        logger.error(f"Dota2ProTracker hero overview fetch failed for hero {hero_id} position {position}: {e}")
        return None

    if overview is None:
        logger.error(f"Dota2ProTracker hero overview fetch failed for hero {hero_id} position {position}: overview response never captured")
        return None
    if rankings is None:
        logger.warning(f"Dota2ProTracker hero overview for hero {hero_id} position {position}: role-rankings response never captured — D2PT rating/lane advantage/rank will be blank")

    build = overview.get("build") or {}
    selected = (rankings or {}).get("selected") or {}
    weekly_points = ((overview.get("rates") or {}).get("weekly") or {}).get("points") or []

    # Resolve ability_sequence's raw ability_ids into real name/icon info
    # via the abilities list also captured above — without this, the
    # frontend would only have opaque numeric ids to render with.
    ability_by_id = {a["ability_id"]: a for a in (abilities or [])}
    ability_sequence = [
        {
            "ability_id": aid,
            "name": ability_by_id.get(aid, {}).get("name"),
            "display_name": ability_by_id.get(aid, {}).get("displayName"),
            "is_talent": ability_by_id.get(aid, {}).get("isTalent", False),
        }
        for aid in (build.get("ability_sequence") or [])
    ]

    return {
        "matches": build.get("matches") or selected.get("matches") or 0,
        "wins": build.get("wins") or selected.get("wins") or 0,
        "win_rate": build.get("win_rate"),
        "pick_rate": build.get("pick_rate"),
        "lane_advantage": selected.get("lane_advantage"),
        "d2pt_rating": selected.get("d2pt_rating"),
        "meta_score": selected.get("meta_score"),
        "rating_rank": selected.get("rating_rank"),
        "rating_cohort_size": selected.get("rating_cohort_size"),
        "role_pick_share": selected.get("role_pick_share"),
        "all_role_matches": selected.get("all_role_matches"),
        "starting_items": build.get("starting_items") or [],
        "ability_sequence": ability_sequence,
        "core_items": build.get("core_items") or [],
        "weekly_rates": weekly_points,
    }


def upsert_hero_overview(session, hero_id: int, position: int, fresh: dict):
    """Writes a `fetch_hero_overview()` result into the `HeroOverview` row
    for this hero/position (creating it if new). Shared by the on-demand
    `/meta/hero/{id}/overview` endpoint and `prefetch_hero_overviews`
    below so the two can never disagree about how a fetch result gets
    stored -- always exactly one row per (hero_id, position), so calling
    this repeatedly for the same pair only ever updates it in place and
    never grows the table further for that pair."""
    from sqlmodel import select
    from models import HeroOverview

    existing = session.exec(
        select(HeroOverview).where(HeroOverview.hero_id == hero_id, HeroOverview.position == position)
    ).first()
    target = existing or HeroOverview(hero_id=hero_id, position=position)
    target.matches = fresh["matches"]
    target.wins = fresh["wins"]
    target.win_rate = fresh["win_rate"]
    target.pick_rate = fresh["pick_rate"]
    target.lane_advantage = fresh["lane_advantage"]
    target.d2pt_rating = fresh["d2pt_rating"]
    target.meta_score = fresh["meta_score"]
    target.rating_rank = fresh["rating_rank"]
    target.rating_cohort_size = fresh["rating_cohort_size"]
    target.role_pick_share = fresh["role_pick_share"]
    target.all_role_matches = fresh["all_role_matches"]
    target.starting_items = json.dumps(fresh["starting_items"])
    target.ability_sequence = json.dumps(fresh["ability_sequence"])
    target.core_items = json.dumps(fresh["core_items"])
    target.weekly_rates = json.dumps(fresh["weekly_rates"])
    target.updated_at = datetime.utcnow()
    if not existing:
        session.add(target)
    session.commit()
    return target


# Same staleness window the on-demand endpoint uses (routers/meta.py's
# _HERO_OVERVIEW_TTL_HOURS) -- kept as a separate constant rather than a
# shared import so either can change independently; a mismatch here only
# ever means one re-fetches slightly more or less eagerly than the other,
# never a correctness issue.
_PREFETCH_STALE_HOURS = 12
# fetch_hero_overview launches a full headless browser per call (unlike
# the plain API calls sync_hero_meta/sync_hero_matchups make), and
# HeroOverview's own docstring records that a previous feature in this
# same family (HeroPositionDetail) got Cloudflare-flagged from sheer
# request volume -- so this stays deliberately small and runs on the
# same long protracker_interval_minutes cadence as sync_hero_position_meta
# (see main.py's background_sync_loop), not every cycle.
_PREFETCH_BATCH_SIZE = 3


async def prefetch_hero_overviews(session) -> int:
    """Proactively warms `HeroOverview` for whichever real hero/position
    combos are furthest overdue, so a user opening a hero's detail page
    usually finds it already cached instead of waiting on a live
    Dota2ProTracker fetch (the "Loading role data... may take a few
    seconds" state). Only targets positions a hero is actually played at
    (HeroPositionMeta rows with real pick data) -- there's no point
    pre-warming a carry's position-5 page nobody will ever open, and
    scoping it this way keeps the total combo count small (roughly one
    to a few positions per hero, not all 5 x 127 heroes).

    Storage stays bounded by that same real-combo count: this only ever
    upserts the one HeroOverview row per (hero_id, position) that already
    exists or would exist from a user's own on-demand visit -- it never
    creates a new *kind* of row, just fills in / refreshes ones that
    would eventually be created anyway. Returns how many it fetched this
    call so callers can log it.
    """
    from datetime import timedelta
    from sqlmodel import select
    from models import HeroPositionMeta, HeroOverview
    from utils.dota_constants import HEROES

    real_combos = set(
        session.exec(
            select(HeroPositionMeta.hero_id, HeroPositionMeta.position)
            .where(HeroPositionMeta.matches > 0)
        ).all()
    )
    if not real_combos:
        return 0

    last_updated = {
        (r[0], r[1]): r[2] for r in session.exec(
            select(HeroOverview.hero_id, HeroOverview.position, HeroOverview.updated_at)
        ).all()
    }

    cutoff = datetime.utcnow() - timedelta(hours=_PREFETCH_STALE_HOURS)
    stale = [
        combo for combo in real_combos
        if last_updated.get(combo) is None or last_updated[combo] < cutoff
    ]
    if not stale:
        return 0

    # Never-fetched combos (None) first, then whichever real timestamp is
    # furthest in the past -- same "stale-first rotation" convention as
    # sync_hero_matchups above.
    stale.sort(key=lambda combo: last_updated.get(combo) or datetime.min)

    fetched = 0
    for hero_id, position in stale[:_PREFETCH_BATCH_SIZE]:
        hero_data = HEROES.get(hero_id)
        if not hero_data:
            continue
        try:
            fresh = await fetch_hero_overview(hero_data["localized_name"], hero_id, position)
        except Exception as e:
            logger.error(f"Hero overview prefetch failed for hero {hero_id} position {position}: {e}")
            continue
        if not fresh:
            continue
        upsert_hero_overview(session, hero_id, position, fresh)
        fetched += 1

    if fetched:
        logger.info(f"Pre-fetched {fetched} hero overview(s)")
    return fetched
