"""
Local replay parser service.

Asks the local odota/parser Docker container to parse a match's replay via
its `/blob?replay_url=<url>` endpoint — the same approach OpenDota's own
backend uses (see odota/core's svc/fetcher/ParsedFetcher.ts). The parser
downloads the replay itself (handling both legacy bz2 and the zstd
compression Valve switched to in 2024), parses it, and returns the fully
aggregated match JSON in one response — players[].purchase_log, kills_log,
obs_log, gold_t, teamfights, etc. There is no raw event stream to reassemble
on our end; POSTing raw .dem bytes to the parser's root `/` endpoint (the
old approach here) returns an unaggregated low-level event log instead and
was the wrong API for this.
"""

import asyncio
import logging
from typing import Optional
from urllib.parse import quote

import httpx

from config import REPLAY_PARSER_URL

logger = logging.getLogger(__name__)

# Coalesce concurrent parse requests for the same match_id onto a single
# in-flight parse — multiple entry points (auto-parse worker, "Parse Replay"
# button, polling GETs that find missing deep data) can all decide to locally
# parse the same match around the same time; without this they each
# independently re-download and re-parse the full replay in parallel.
_inflight: dict[int, asyncio.Task] = {}


async def parse_match_locally(match_id: int, cluster_id: int, replay_salt: int) -> Optional[dict]:
    """
    Ask the local odota/parser container to parse this match's replay.

    Returns the parsed match dict (OpenDota-shaped: a "players" array with
    purchase_log/kills_log/obs_log/etc. per player, plus top-level
    teamfights/objectives/chat/radiant_gold_adv/etc.), or None on failure.
    """
    existing = _inflight.get(match_id)
    if existing is not None and not existing.done():
        logger.info(f"[{match_id}] Parse already in progress — waiting on it instead of starting a duplicate")
        return await existing

    task = asyncio.ensure_future(_parse_match_locally_impl(match_id, cluster_id, replay_salt))
    _inflight[match_id] = task
    try:
        return await task
    finally:
        if _inflight.get(match_id) is task:
            _inflight.pop(match_id, None)


async def _parse_match_locally_impl(match_id: int, cluster_id: int, replay_salt: int) -> Optional[dict]:
    replay_url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"

    parser_base = (REPLAY_PARSER_URL or "http://replay_parser:5600").rstrip("/")
    blob_url = f"{parser_base}/blob?replay_url={quote(replay_url, safe='')}"

    logger.info(f"[{match_id}] Requesting local parse via {blob_url}")

    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.get(blob_url)
        except httpx.ConnectError as e:
            logger.error(
                f"[{match_id}] Cannot connect to parser container at {parser_base}. "
                f"Is odota/parser running? Error: {e}"
            )
            return None
        except Exception as e:
            logger.error(f"[{match_id}] Parser request failed: {e}")
            return None

    if resp.status_code != 200:
        logger.error(f"[{match_id}] Parser container returned {resp.status_code}: {resp.text[:300]}")
        return None

    try:
        data = resp.json()
    except Exception as e:
        logger.error(f"[{match_id}] Parser response was not valid JSON: {e}")
        return None

    if not isinstance(data, dict) or not data.get("players"):
        logger.error(f"[{match_id}] Parser response missing a players array")
        return None

    logger.info(f"[{match_id}] Local parse successful — {len(data['players'])} players")
    return data
