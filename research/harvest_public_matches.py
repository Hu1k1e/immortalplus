"""
Phase 1 data harvester: draft + outcome + rank for as many public matches as
OpenDota's Explorer will give us, with zero replay parsing. This alone is
enough to build hero synergy/counter/win-rate-by-rank tables (the "book").

Uses OpenDota's Explorer SQL endpoint (/explorer), which queries their
warehouse directly and returns far more rows per call than the /publicMatches
REST endpoint's ~100-per-call live tail — the right tool for bulk historical
backfill. Reuses the app's existing rate-limited OpenDotaClient (backend/
services/opendota.py) rather than a second, uncoordinated limiter, so this
can safely run alongside the live app without risking a 429 that affects it.

Resumable by design: for each rank bucket, tracks the oldest match_id already
stored and resumes backfilling older matches from there on the next run.
Safe to Ctrl+C and restart at any time (INSERT OR IGNORE, commits per page).

Usage:
    python harvest_public_matches.py --rank-min 10 --rank-max 80 --target 20000
    python harvest_public_matches.py --rank-min 70 --rank-max 80 --target 5000  # Immortal only

Rank tiers (avg_rank_tier, medal*10 + star): Herald 10-19, Guardian 20-29,
Crusader 30-39, Archon 40-49, Legend 50-59, Ancient 60-69, Divine 70-79,
Immortal 80 (no stars).
"""

import argparse
import asyncio
import json
import logging
import sqlite3
import sys
from pathlib import Path

# Reuse the app's existing rate-limited, cached OpenDota client instead of
# rolling a second one that could uncoordinatedly exceed OpenDota's real
# rate limit alongside the live app.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from services.opendota import get_opendota_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("harvester")

DB_PATH = Path(__file__).resolve().parent / "data" / "public_matches.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS matches (
    match_id INTEGER PRIMARY KEY,
    radiant_win INTEGER,
    start_time INTEGER,
    duration INTEGER,
    lobby_type INTEGER,
    game_mode INTEGER,
    avg_rank_tier INTEGER,
    radiant_heroes TEXT,
    dire_heroes TEXT,
    fetched_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_rank_tier ON matches(avg_rank_tier);
"""


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    return conn


def oldest_match_id(conn: sqlite3.Connection, rank_min: int, rank_max: int) -> int | None:
    row = conn.execute(
        "SELECT MIN(match_id) FROM matches WHERE avg_rank_tier BETWEEN ? AND ?",
        (rank_min, rank_max),
    ).fetchone()
    return row[0] if row and row[0] else None


async def harvest(rank_min: int, rank_max: int, target: int, page_size: int, lobby_type: int | None, exclude_turbo: bool):
    conn = get_db()
    client = get_opendota_client()

    already = conn.execute(
        "SELECT COUNT(*) FROM matches WHERE avg_rank_tier BETWEEN ? AND ?",
        (rank_min, rank_max),
    ).fetchone()[0]
    logger.info(f"Rank bracket {rank_min}-{rank_max}: {already} matches already stored, target {target}")

    cursor = oldest_match_id(conn, rank_min, rank_max)
    fetched_this_run = 0

    while already + fetched_this_run < target:
        cursor_clause = f"AND match_id < {cursor}" if cursor else ""
        lobby_clause = f"AND lobby_type = {lobby_type}" if lobby_type is not None else ""
        turbo_clause = "AND game_mode != 23" if exclude_turbo else ""
        # duration > 300: excludes matches still in progress (duration=0,
        # not yet fully ingested by OpenDota) and very early abandons.
        sql = f"""
            SELECT match_id, radiant_win, start_time, duration, lobby_type,
                   game_mode, avg_rank_tier, radiant_team, dire_team
            FROM public_matches
            WHERE avg_rank_tier BETWEEN {rank_min} AND {rank_max}
              AND duration > 300
              {lobby_clause}
              {turbo_clause}
              {cursor_clause}
            ORDER BY match_id DESC
            LIMIT {page_size}
        """
        try:
            result = await client.explorer_query(sql)
        except Exception as e:
            logger.error(f"Explorer query failed: {e} — retrying in 30s")
            await asyncio.sleep(30)
            continue

        rows = result.get("rows", [])
        if not rows:
            logger.info("No more rows returned for this bracket — likely caught up to Explorer's history limit.")
            break

        for r in rows:
            conn.execute(
                "INSERT OR IGNORE INTO matches "
                "(match_id, radiant_win, start_time, duration, lobby_type, game_mode, avg_rank_tier, radiant_heroes, dire_heroes) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    r["match_id"], int(bool(r["radiant_win"])), r["start_time"], r["duration"],
                    r["lobby_type"], r["game_mode"], r["avg_rank_tier"],
                    json.dumps(r.get("radiant_team")), json.dumps(r.get("dire_team")),
                ),
            )
        conn.commit()

        cursor = min(r["match_id"] for r in rows)
        fetched_this_run += len(rows)
        logger.info(f"  +{len(rows)} rows (cursor now {cursor}), running total this session: {fetched_this_run}")

    total_now = conn.execute(
        "SELECT COUNT(*) FROM matches WHERE avg_rank_tier BETWEEN ? AND ?",
        (rank_min, rank_max),
    ).fetchone()[0]
    logger.info(f"Done. Rank bracket {rank_min}-{rank_max} now has {total_now} matches stored.")
    await client.close()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rank-min", type=int, default=10, help="Lowest avg_rank_tier to include (10=Herald)")
    p.add_argument("--rank-max", type=int, default=80, help="Highest avg_rank_tier to include (80=Immortal)")
    p.add_argument("--target", type=int, default=10000, help="Stop once this many matches are stored for the bracket")
    p.add_argument("--page-size", type=int, default=2000, help="Rows per Explorer query")
    p.add_argument("--lobby-type", type=int, default=7, help="OpenDota lobby_type filter (7=Ranked Matchmaking; pass -1 for any)")
    p.add_argument("--include-turbo", action="store_true", help="Include Turbo (game_mode 23) matches — off by default, different pace/economy")
    args = p.parse_args()

    lobby_type = None if args.lobby_type == -1 else args.lobby_type
    asyncio.run(harvest(args.rank_min, args.rank_max, args.target, args.page_size, lobby_type, not args.include_turbo))


if __name__ == "__main__":
    main()
