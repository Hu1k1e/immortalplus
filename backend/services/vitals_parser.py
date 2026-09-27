"""
Hero HP/Mana time-series reconstruction.

Primary path: real data. Upstream odota/parser's per-second "interval"
entries never carried health/mana, so we forked it (see ../../parser/,
built as ghcr.io/hu1k1e/immortalplus-parser and referenced by
docker-compose.yml in place of odota/parser:latest) to add four fields —
hp/max_hp/mana/max_mana — read directly off the hero entity
(m_iHealth/m_iMaxHealth/m_flMana/m_flMaxMana) the same way life_state
already was. These are real observed values, including mana spent on
ability casts, which no combat-log event ever recorded.

Fallback path: if a stream comes back without those fields (e.g. briefly
mid-rollout, before every deployment is running the patched parser image),
this reconstructs HP/Mana from combat-log damage/heal instances instead —
real per-instance events, but blind to ability-cast mana cost, so the mana
curve in that path tracks regen and heals accurately but not spell casts.
Combined with each hero's real base stats (base_health/base_mana/base_str/
str_gain/base_int/int_gain/base_health_regen/base_mana_regen — read from
the same heroes.json the frontend ships) and the standard Dota formulas
(MaxHP = base_health + Strength*22, MaxMana = base_mana + Intelligence*12,
matching frontend's lib/heroVitals.ts), plus Dota's known
respawn-time-by-level formula for the one piece the combat log has no
explicit event for (respawn).
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
    npc_name_by_slot: dict[int, str] = {}
    level_by_slot: dict[int, int] = {}
    real_mode: Optional[bool] = None

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

    real_last_sample: dict[int, float] = {}

    def maybe_sample_real(pslot: int, t: float, hp_v: float, max_hp_v: float, mana_v: float, max_mana_v: float):
        if pslot not in series:
            series[pslot] = {"time": [], "hp": [], "mana": [], "max_hp": [], "max_mana": []}
        if t - real_last_sample.get(pslot, -999) < 2:
            return
        real_last_sample[pslot] = t
        s = series[pslot]
        s["time"].append(round(t, 1))
        s["hp"].append(round(max(0.0, hp_v), 1))
        s["mana"].append(round(max(0.0, mana_v), 1))
        s["max_hp"].append(round(max_hp_v, 1))
        s["max_mana"].append(round(max_mana_v, 1))

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

            # Pre-game/strategy-phase interval entries (stage 2, before hero
            # entities exist) never carry hp/mana/hero_id/unit at all — real
            # or not. Deciding real_mode from one of those would wrongly
            # lock in "fallback" before real data even starts a few seconds
            # later, so wait for an entry where a hero is actually assigned
            # (hero_id set — exactly the same condition under which the
            # patched parser populates hp/mana) before deciding.
            if real_mode is None and entry.get("hero_id"):
                real_mode = entry.get("hp") is not None and entry.get("mana") is not None

            if real_mode:
                hp_v, max_hp_v = entry.get("hp"), entry.get("max_hp")
                mana_v, max_mana_v = entry.get("mana"), entry.get("max_mana")
                if hp_v is not None and max_hp_v is not None and mana_v is not None and max_mana_v is not None:
                    maybe_sample_real(pslot, t, float(hp_v), float(max_hp_v), float(mana_v), float(max_mana_v))
            elif real_mode is False:
                ensure_init(pslot, t)
                advance_regen(pslot, t)
                maybe_sample(pslot, t)
            # else real_mode is still undetermined (no hero assigned yet in
            # this pre-game entry) — nothing to sample either way yet.
            continue

        # Fallback only: combat log damage/heal, used to reconstruct HP/Mana
        # when the parser stream doesn't carry real hp/mana on interval
        # entries (see module docstring). Skipped entirely once real_mode
        # is confirmed true, since real per-second values are already exact.
        if real_mode:
            continue
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
    mode = "REAL (m_iHealth/m_flMana read directly from the patched parser)" if real_mode else "FALLBACK (reconstructed from combat-log damage/heal — old parser image, or no interval hp/mana seen)"
    logger.info(f"[{match_id}] Vitals parse: {len(series)} players, {total_points} total samples, mode={mode}")
    return series
