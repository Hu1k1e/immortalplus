"""
Auto-parse worker service.

Continuously monitors for unprocessed matches and parses them automatically.
Strategy for each unparsed match:
1. Request OpenDota to parse (for benchmarks/player names/percentiles).
2. Try to download replay from Valve CDN and parse locally via odota/parser
   (for purchase_log, ward logs, teamfights, etc. — all the deep data).
3. If either fails (replay not yet available), retry with exponential backoff.
4. Give up after 7 days (Valve deletes replays after that window).

This runs as a completely independent background loop alongside the sync loop.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

import httpx

logger = logging.getLogger(__name__)

# How long to wait between parse worker cycles (seconds)
PARSE_WORKER_INTERVAL = 60  # Check every 60 seconds

# Retry backoff schedule (minutes between attempts by attempt number)
# Attempt 0→1: wait 2 min (replay may not be up yet right after match)
# Attempt 1→2: wait 5 min
# Attempt 2→3: wait 10 min
# Attempt 3+:  wait 30 min
RETRY_DELAYS_MINUTES = [2, 5, 10, 30, 30, 30, 30, 30, 30, 30]

# Valve keeps replays for ~7 days. After that, give up.
REPLAY_EXPIRY_DAYS = 7

# How many matches to process per cycle (don't overwhelm the parser)
MAX_PER_CYCLE = 5


def _next_retry_delay(attempts: int) -> timedelta:
    """Return how long to wait before the next parse attempt."""
    idx = min(attempts, len(RETRY_DELAYS_MINUTES) - 1)
    return timedelta(minutes=RETRY_DELAYS_MINUTES[idx])


def _replay_expired(played_at: datetime) -> bool:
    """Return True if the match replay is older than Valve's retention window."""
    if not played_at:
        return False
    now = datetime.now(timezone.utc)
    age = now - played_at.replace(tzinfo=timezone.utc)
    return age > timedelta(days=REPLAY_EXPIRY_DAYS)


async def _check_replay_available(cluster: int, salt: int, match_id: int) -> bool:
    """HEAD-request the Valve CDN to see if the replay is ready yet."""
    url = f"http://replay{cluster}.valve.net/570/{match_id}_{salt}.dem.bz2"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.head(url)
            return r.status_code == 200
    except Exception:
        return False


async def auto_parse_worker():
    """
    Background task: continuously find unparsed matches and parse them.
    Runs forever alongside background_sync_loop in main.py.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Match, Player, UserSettings
    from services.opendota import get_opendota_client
    from services.local_parser import parse_match_locally
    from services.parser_aggregator import aggregate_parser_output
    from services.sync import fetch_match_details

    # Wait for app to fully start
    await asyncio.sleep(15)
    logger.info("Auto-parse worker started")

    while True:
        try:
            session = SessionLocal()
            settings = session.exec(select(UserSettings).limit(1)).first()
            player = session.exec(select(Player).order_by(Player.id.desc()).limit(1)).first()

            if not player or not settings:
                session.close()
                await asyncio.sleep(PARSE_WORKER_INTERVAL)
                continue

            now = datetime.now(timezone.utc)

            # Find matches that need (local) parsing:
            # Condition: purchase_log is NULL (deep parse data is missing)
            # This covers:
            #   - is_parsed=False (never processed at all)
            #   - is_parsed=True but purchase_log=NULL (OD basic data came through, deep parse missing)
            # NOT permanently failed, NOT already has deep data
            from sqlalchemy import or_
            all_unparsed = session.exec(
                select(Match)
                .where(Match.player_id == player.id)
                .where(Match.purchase_log == None)  # Deep parse data is missing
                .where(Match.parse_failed_permanently == False)
                .order_by(Match.match_id.desc())
                .limit(50)
            ).all()

            steam_api_key = settings.steam_api_key if settings else None

            # Filter to those that are ready for a (re-)attempt
            ready = []
            for m in all_unparsed:
                if _replay_expired(m.played_at):
                    logger.info(f"Match {m.match_id}: replay expired (>7 days), marking permanently failed")
                    m.parse_failed_permanently = True
                    session.commit()
                    continue

                if m.last_parse_attempt is None:
                    ready.append(m)
                else:
                    delay = _next_retry_delay(m.parse_attempts)
                    last_attempt_utc = m.last_parse_attempt.replace(tzinfo=timezone.utc)
                    if now - last_attempt_utc >= delay:
                        ready.append(m)

            # Extract the API keys so we don't pass a detached SQLModel instance
            od_api_key = settings.opendota_api_key if settings else None
            session.close()

            # Process up to MAX_PER_CYCLE per loop
            for match in ready[:MAX_PER_CYCLE]:
                await _parse_one_match(match.match_id, od_api_key, steam_api_key)

        except Exception as e:
            logger.error(f"Auto-parse worker error: {e}", exc_info=True)

        await asyncio.sleep(PARSE_WORKER_INTERVAL)


async def _parse_one_match(match_id: int, od_api_key: str = None, steam_api_key: str = None):
    """
    Attempt to fully parse one match:
    1. Tell OpenDota to parse (for benchmarks/percentiles).
    2. Download from Valve CDN + local parser (for all deep logs).
    3. Merge both sources and store in DB.
    """
    from sqlmodel import select
    from database import SessionLocal
    from models import Match, UserSettings
    from services.opendota import get_opendota_client
    from services.local_parser import parse_match_locally
    from services.parser_aggregator import aggregate_parser_output
    from services.steam import resolve_cluster_salt
    from services.sync import fetch_match_details

    session = SessionLocal()
    try:
        match = session.exec(select(Match).where(Match.match_id == match_id)).first()
        if not match:
            return

        now = datetime.now(timezone.utc)
        match.last_parse_attempt = now
        match.parse_attempts = (match.parse_attempts or 0) + 1
        session.commit()

        logger.info(f"Auto-parse attempt #{match.parse_attempts} for match {match_id}")

        od_client = get_opendota_client(od_api_key)

        # --- Step 1: Get cluster/salt so we know the replay URL ---
        # Steam API is tried first (fast + reliable), falling back to OpenDota's
        # own (often not-yet-populated) cluster/replay_salt fields.
        cluster, salt = await resolve_cluster_salt(match, od_client, steam_api_key=steam_api_key)
        session.commit()  # persist opendota_raw if resolve_cluster_salt fetched+stored it
        logger.info(f"[{match_id}] cluster={cluster}, replay_salt={salt}")


        # --- Step 2: Submit OpenDota parse request (for percentiles) ---
        try:
            od_job = await od_client.request_parse(match_id)
            logger.info(f"[{match_id}] OpenDota parse requested: {od_job}")
        except Exception as e:
            logger.warning(f"[{match_id}] OpenDota parse request failed: {e}")

        # --- Step 3: Check if replay is available on Valve CDN ---
        if not cluster or not salt:
            logger.warning(f"[{match_id}] No cluster/salt — cannot attempt local parse yet")
            session.close()
            return

        replay_ready = await _check_replay_available(cluster, salt, match_id)
        if not replay_ready:
            logger.info(f"[{match_id}] Replay not yet available on Valve CDN — will retry later")
            session.close()
            return

        # --- Step 4: Local parse ---
        logger.info(f"[{match_id}] Replay available — starting local parse (cluster={cluster})")
        raw_lines = await parse_match_locally(match_id, cluster, salt)
        if not raw_lines:
            logger.warning(f"[{match_id}] Local parse returned no data")
            session.close()
            return

        local_data = aggregate_parser_output(raw_lines, {})
        if not local_data:
            logger.warning(f"[{match_id}] Aggregator returned no data")
            session.close()
            return

        # --- Step 5: Fetch full OpenDota data (benchmarks, names) and merge ---
        # Invalidate the OD cache so we re-fetch fresh data (OpenDota may now have parsed it).
        # Pass the local_data we just parsed so it's merged in directly instead of
        # being silently discarded and re-derived (and potentially re-parsed) here.
        match.opendota_raw = None
        match.gold_t = None
        match.all_players = None
        session.commit()

        settings = session.exec(select(UserSettings).limit(1)).first()
        success = await fetch_match_details(session, match, settings, local_parse_data=local_data)
        if success:
            session.refresh(match)
            logger.info(f"[{match_id}] Auto-parse COMPLETE. is_parsed={match.is_parsed}, "
                       f"has_purchase_log={match.purchase_log is not None}, "
                       f"has_benchmarks={match.benchmarks is not None}")
        else:
            logger.warning(f"[{match_id}] fetch_match_details returned False after local parse")

    except Exception as e:
        logger.error(f"[{match_id}] _parse_one_match failed: {e}", exc_info=True)
    finally:
        session.close()
