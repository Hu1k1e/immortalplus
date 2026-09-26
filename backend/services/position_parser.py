"""
Hero position time-series extraction.

odota/parser's `/blob` endpoint (used for everything else — purchase_log,
kills_log, etc.) discards hero position data: its Java source
(CreateParsedDataBlob.java) has `case "interval": break;` when building the
final aggregated response. But the RAW event stream (POST / with raw .dem
bytes — the endpoint local_parser.py used before it switched to /blob) does
emit "interval" entries: one per hero, every 1 real game-second
(Parse.java: `float INTERVAL = 1;`), each carrying a precise x/y computed
straight from replay entity data (`CBodyComponent.m_cellX/Y` +
`m_vecX/Y`) — the exact same `getPreciseLocation()` transform obs_log/sen_log
already use, so it drops into the same `(x-64)/128` normalization the
frontend already applies. This module downloads+decompresses the replay
itself (the raw endpoint needs bytes, not a URL, unlike /blob), POSTs it,
and extracts a compact per-player-slot {time, x, y, life_state} series from
the interval entries — discarding everything else in the ~90k-line raw
stream rather than storing it.
"""

import bz2
import io
import json
import logging
from typing import Optional

import httpx

from config import REPLAY_PARSER_URL

logger = logging.getLogger(__name__)

_ZSTD_MAGIC = b'\x28\xb5\x2f\xfd'
_BZ2_MAGIC = b'BZh'


def _decompress(data: bytes) -> Optional[bytes]:
    if data[:4] == _ZSTD_MAGIC:
        try:
            import zstandard
            dctx = zstandard.ZstdDecompressor()
            with dctx.stream_reader(io.BytesIO(data)) as reader:
                return reader.read()
        except Exception as e:
            logger.error(f"zstd decompression failed: {e}")
            return None
    elif data[:3] == _BZ2_MAGIC:
        try:
            return bz2.decompress(data)
        except Exception as e:
            logger.error(f"bz2 decompression failed: {e}")
            return None
    else:
        return data


async def parse_hero_positions(match_id: int, cluster_id: int, replay_salt: int) -> Optional[dict]:
    """
    Returns { player_slot: {"time": [...], "x": [...], "y": [...], "life_state": [...]} }
    for all 10 players, or None on failure. Every array is 1-per-game-second.
    """
    url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": "ImmortalPlus/1.0"})
        except Exception as e:
            logger.error(f"[{match_id}] Position parse: replay download failed: {e}")
            return None
        if resp.status_code != 200:
            logger.error(f"[{match_id}] Position parse: Valve CDN returned {resp.status_code}")
            return None
        dem_data = _decompress(resp.content)
        if not dem_data:
            logger.error(f"[{match_id}] Position parse: decompression failed")
            return None

    parser_base = (REPLAY_PARSER_URL or "http://replay_parser:5600").rstrip("/")

    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(parser_base + "/", content=dem_data, headers={"Content-Type": "application/octet-stream"})
        except Exception as e:
            logger.error(f"[{match_id}] Position parse: parser request failed: {e}")
            return None
        if resp.status_code != 200:
            logger.error(f"[{match_id}] Position parse: parser returned {resp.status_code}")
            return None
        raw_text = resp.text

    slot_to_player_slot: dict[int, int] = {}
    series: dict[int, dict[str, list]] = {}

    for line in raw_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        etype = entry.get("type")
        if etype == "player_slot":
            try:
                slot_to_player_slot[int(entry.get("key"))] = entry.get("value")
            except (TypeError, ValueError):
                continue
        elif etype == "interval":
            slot = entry.get("slot")
            x = entry.get("x")
            y = entry.get("y")
            if slot is None or x is None or y is None:
                continue
            bucket = series.setdefault(slot, {"time": [], "x": [], "y": [], "life_state": []})
            bucket["time"].append(entry.get("time"))
            bucket["x"].append(round(x, 1))
            bucket["y"].append(round(y, 1))
            bucket["life_state"].append(entry.get("life_state"))

    if not series:
        logger.warning(f"[{match_id}] Position parse: no interval entries found in raw stream")
        return None

    # Re-key by player_slot (0-4, 128-132) instead of the raw 0-9 slot index
    result: dict[int, dict] = {}
    for slot, data in series.items():
        player_slot = slot_to_player_slot.get(slot)
        if player_slot is None:
            continue
        result[player_slot] = data

    total_points = sum(len(v["time"]) for v in result.values())
    logger.info(f"[{match_id}] Position parse: {len(result)} players, {total_points} total position samples")
    return result if result else None
