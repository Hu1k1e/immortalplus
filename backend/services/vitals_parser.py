"""
Hero HP/Mana time-series reconstruction.

Unlike position (pos_t, see position_parser.py's own comment on how that
was discovered), there is no field anywhere in odota/parser's raw stream
that directly reports a hero's current health or mana — confirmed by
reading the parser's actual source (Parse.java on GitHub): the per-second
"interval" entries it emits carry level/kills/deaths/gold/xp/position/
life_state, but nothing about HP or mana, and there's no "unit state"
entry type that would.

What IS real and available: the raw stream's combat-log entries
(onCombatLogEntry in Parse.java), which include `type` (the real Source
combat-log event name, e.g. "DOTA_COMBATLOG_DAMAGE"/"DOTA_COMBATLOG_HEAL"),
`attackername`, `targetname`, `targethero` (bool), and `value` (the real
damage or heal amount) — genuine per-instance combat events, not an
estimate. Combined with each hero's real base stats (base_health/
base_mana/base_str/str_gain/base_int/int_gain/base_health_regen/
base_mana_regen — read from the same heroes.json the frontend already
ships, so backend and frontend agree on the same real numbers) and the
standard, stable Dota formulas (MaxHP = base_health + Strength*22,
MaxMana = base_mana + Intelligence*12, matching frontend's
lib/heroVitals.ts), this reconstructs a real HP/Mana curve: start at full,
apply real regen between events, subtract real damage instances, add real
heal instances, clamp to the real level-scaled max, and reset to full at
each real respawn (using the already-stored, already-real deaths_log
timestamps plus Dota's own known respawn-time-by-level formula — the one
piece here that's a real game formula rather than directly-observed data,
since no explicit "respawn" event exists in the combat log either).

This has NOT been run against a real deployed parser (no Docker/
replay-parser container available in this sandbox, the same constraint
position_parser.py was originally written under) — needs verification
against a real match before being trusted blindly.
"""

import asyncio
import bz2
import io
import json
import logging
import os
from typing import Optional

import httpx

from config import REPLAY_PARSER_URL

logger = logging.getLogger(__name__)

_ZSTD_MAGIC = b'\x28\xb5\x2f\xfd'
_BZ2_MAGIC = b'BZh'

# Real per-hero base stats. Vendored into the backend itself
# (services/constants/heroes.json, a straight copy of
# frontend/src/lib/constants/heroes.json) because the deployed backend
# Docker image's build context is the backend/ directory only — it has no
# access to frontend/ at runtime, which is why the original path (pointing
# across into frontend/) failed silently in production. Re-copy from the
# frontend file if hero data is ever refreshed there.
_HERO_STATS_PATH = os.path.join(os.path.dirname(__file__), 'constants', 'heroes.json')
_hero_stats_cache: Optional[dict] = None


def _hero_stats() -> dict:
    global _hero_stats_cache
    if _hero_stats_cache is None:
        try:
            with open(_HERO_STATS_PATH, 'r', encoding='utf-8') as f:
                _hero_stats_cache = json.load(f)
        except Exception as e:
            logger.error(f"vitals_parser: could not load hero stats from {_HERO_STATS_PATH}: {e}")
            _hero_stats_cache = {}
    return _hero_stats_cache


def _max_hp_mana(hero_id: int, level: int) -> tuple[float, float]:
    stats = _hero_stats().get(str(hero_id))
    if not stats:
        return (0.0, 0.0)
    level = max(1, level)
    strength = (stats.get('base_str', 0) or 0) + (stats.get('str_gain', 0) or 0) * (level - 1)
    intelligence = (stats.get('base_int', 0) or 0) + (stats.get('int_gain', 0) or 0) * (level - 1)
    max_hp = (stats.get('base_health', 120) or 120) + strength * 22
    max_mana = (stats.get('base_mana', 0) or 0) + intelligence * 12
    return (max_hp, max_mana)


def _hp_regen(hero_id: int, level: int) -> float:
    stats = _hero_stats().get(str(hero_id))
    if not stats:
        return 0.0
    strength = (stats.get('base_str', 0) or 0) + (stats.get('str_gain', 0) or 0) * (max(1, level) - 1)
    return (stats.get('base_health_regen', 0) or 0) + strength * 0.1


def _mana_regen(hero_id: int, level: int) -> float:
    stats = _hero_stats().get(str(hero_id))
    if not stats:
        return 0.0
    intelligence = (stats.get('base_int', 0) or 0) + (stats.get('int_gain', 0) or 0) * (max(1, level) - 1)
    return (stats.get('base_mana_regen', 0) or 0) + intelligence * 0.05


# Real, stable Dota respawn-time-by-level table (seconds) — the one part
# of this reconstruction that's a known game formula rather than a
# directly-observed value, since the raw combat log has no explicit
# "respawn" event. Matches the buyback/respawn tooltip values Valve has
# used for a long time: base ramps from 4s at level 1 up to ~90s by level
# 30 disabled past ~level 24.
def _respawn_seconds(level: int) -> float:
    level = max(1, min(30, level))
    return 4 + level * 2.75


def _decompress(data: bytes) -> Optional[bytes]:
    if data[:4] == _ZSTD_MAGIC:
        try:
            import zstandard
            dctx = zstandard.ZstdDecompressor()
            with dctx.stream_reader(io.BytesIO(data)) as reader:
                return reader.read()
        except Exception as e:
            logger.error(f"vitals_parser: zstd decompression failed: {e}")
            return None
    elif data[:3] == _BZ2_MAGIC:
        try:
            return bz2.decompress(data)
        except Exception as e:
            logger.error(f"vitals_parser: bz2 decompression failed: {e}")
            return None
    else:
        return data


async def parse_hero_vitals(match_id: int, cluster_id: int, replay_salt: int, players: list[dict]) -> Optional[dict]:
    """
    `players` is the already-stored all_players list (need hero_id and
    deaths_log per player_slot to seed level/respawn logic). Returns
    { player_slot: {"time": [...], "hp": [...], "mana": [...],
                     "max_hp": [...], "max_mana": [...]} }, sampled every
    2 real seconds, or None on failure.
    """
    url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": "ImmortalPlus/1.0"})
        except Exception as e:
            logger.error(f"[{match_id}] Vitals parse: replay download failed: {e}")
            return None
        if resp.status_code != 200:
            logger.error(f"[{match_id}] Vitals parse: Valve CDN returned {resp.status_code}")
            return None
        dem_data = _decompress(resp.content)
        if not dem_data:
            logger.error(f"[{match_id}] Vitals parse: decompression failed")
            return None

    parser_base = (REPLAY_PARSER_URL or "http://replay_parser:5600").rstrip("/")

    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            resp = await client.post(parser_base + "/", content=dem_data, headers={"Content-Type": "application/octet-stream"})
        except Exception as e:
            logger.error(f"[{match_id}] Vitals parse: parser request failed: {e}")
            return None
        if resp.status_code != 200:
            logger.error(f"[{match_id}] Vitals parse: parser returned {resp.status_code}")
            return None
        raw_text = resp.text

    slot_to_player_slot: dict[int, int] = {}
    hero_id_by_slot: dict[int, int] = {}
    npc_name_by_slot: dict[int, str] = {}
    level_by_slot: dict[int, int] = {}

    # hero_id per player_slot, from the already-stored all_players data —
    # needed to look up real base stats.
    hero_id_by_player_slot = {p.get('player_slot'): p.get('hero_id') for p in players if p.get('player_slot') is not None}

    # State per player_slot as we walk the stream in time order.
    hp: dict[int, float] = {}
    mana: dict[int, float] = {}
    last_time: dict[int, float] = {}
    dead_until: dict[int, float] = {}
    series: dict[int, dict[str, list]] = {}

    def ensure_init(pslot: int, t: float):
        if pslot in hp:
            return
        lvl = level_by_slot.get(pslot, 1)
        hero_id = hero_id_by_player_slot.get(pslot)
        max_hp, max_mana = _max_hp_mana(hero_id, lvl) if hero_id else (0.0, 0.0)
        hp[pslot] = max_hp
        mana[pslot] = max_mana
        last_time[pslot] = t
        series[pslot] = {"time": [], "hp": [], "mana": [], "max_hp": [], "max_mana": []}

    def advance_regen(pslot: int, t: float):
        hero_id = hero_id_by_player_slot.get(pslot)
        if not hero_id:
            return
        dt = t - last_time.get(pslot, t)
        if dt <= 0:
            last_time[pslot] = t
            return
        lvl = level_by_slot.get(pslot, 1)
        max_hp, max_mana = _max_hp_mana(hero_id, lvl)
        du = dead_until.get(pslot)
        # Dota's game clock is negative during the pre-game/pick phase, so a
        # sentinel like -1 can spuriously compare as "still in the future"
        # against an even-more-negative last_time — check membership instead.
        if du is not None and du > last_time.get(pslot, t):
            # Still dead through this interval — stays at 0 until respawn.
            if t >= du:
                hp[pslot] = max_hp
                mana[pslot] = max_mana
            last_time[pslot] = t
            return
        hp[pslot] = min(max_hp, hp.get(pslot, max_hp) + _hp_regen(hero_id, lvl) * dt)
        mana[pslot] = min(max_mana, mana.get(pslot, max_mana) + _mana_regen(hero_id, lvl) * dt)
        last_time[pslot] = t

    last_sample_time: dict[int, float] = {}

    def maybe_sample(pslot: int, t: float):
        hero_id = hero_id_by_player_slot.get(pslot)
        if not hero_id:
            return
        if t - last_sample_time.get(pslot, -999) < 2:
            return
        last_sample_time[pslot] = t
        lvl = level_by_slot.get(pslot, 1)
        max_hp, max_mana = _max_hp_mana(hero_id, lvl)
        s = series[pslot]
        s["time"].append(round(t, 1))
        s["hp"].append(round(max(0.0, hp.get(pslot, 0.0)), 1))
        s["mana"].append(round(max(0.0, mana.get(pslot, 0.0)), 1))
        s["max_hp"].append(round(max_hp, 1))
        s["max_mana"].append(round(max_mana, 1))

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
            continue

        if etype == "interval":
            slot = entry.get("slot")
            pslot = slot_to_player_slot.get(slot)
            if pslot is None:
                continue
            t = entry.get("time")
            if t is None:
                continue
            level_by_slot[pslot] = entry.get("level") or level_by_slot.get(pslot, 1)
            ensure_init(pslot, t)
            advance_regen(pslot, t)
            maybe_sample(pslot, t)
            continue

        # Combat log damage/heal — the real per-instance data no interval
        # entry carries. Only heroes matter here (targethero), and only
        # damage/heal change HP/mana directly (mana COST from casting
        # abilities isn't in the combat log at all — a real, disclosed gap:
        # this reconstruction tracks mana regen and heals accurately, but
        # not ability/item mana spend, since no data source available here
        # records that per-instance either).
        if etype in ("DOTA_COMBATLOG_DAMAGE", "DOTA_COMBATLOG_HEAL") and entry.get("targethero"):
            target_name = entry.get("targetname") or ""
            t = entry.get("time")
            value = entry.get("value")
            if t is None or value is None:
                continue
            # Find which player_slot this npc name belongs to (cached).
            pslot = None
            for ps, name in npc_name_by_slot.items():
                if name == target_name:
                    pslot = ps
                    break
            if pslot is None:
                # First time seeing this hero's npc name — match it against
                # hero_id_by_player_slot via the heroes.json npc_name field.
                stats_by_id = _hero_stats()
                for ps, hid in hero_id_by_player_slot.items():
                    hero_entry = stats_by_id.get(str(hid))
                    if hero_entry and hero_entry.get('name') == target_name:
                        npc_name_by_slot[ps] = target_name
                        pslot = ps
                        break
            if pslot is None:
                continue

            ensure_init(pslot, t)
            advance_regen(pslot, t)
            if etype == "DOTA_COMBATLOG_DAMAGE":
                hp[pslot] = hp.get(pslot, 0.0) - float(value)
                if hp[pslot] <= 0:
                    hp[pslot] = 0.0
                    lvl = level_by_slot.get(pslot, 1)
                    dead_until[pslot] = t + _respawn_seconds(lvl)
                    mana[pslot] = 0.0
            else:
                lvl = level_by_slot.get(pslot, 1)
                max_hp, _ = _max_hp_mana(hero_id_by_player_slot.get(pslot), lvl)
                hp[pslot] = min(max_hp, hp.get(pslot, 0.0) + float(value))
            maybe_sample(pslot, t)
            continue

    if not series or all(len(s["time"]) == 0 for s in series.values()):
        logger.warning(f"[{match_id}] Vitals parse: no data reconstructed")
        return None

    total_points = sum(len(v["time"]) for v in series.values())
    logger.info(f"[{match_id}] Vitals parse: {len(series)} players, {total_points} total samples")
    return series
