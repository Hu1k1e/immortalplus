import json
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

def aggregate_parser_output(json_lines: str, account_id_to_slot: dict) -> dict:
    """
    Takes the raw JSON lines output from odota/parser and aggregates it into 
    the structure expected by the Immortal+ frontend (matching OpenDota API).
    """
    lines = json_lines.strip().split('\n')
    
    players = {i: {
        "player_slot": i,
        "kills_log": [],
        "purchase_log": [],
        "obs_log": [],
        "sen_log": [],
        "runes_log": [],
        "gold_reasons": defaultdict(int),
        "xp_reasons": defaultdict(int),
        "hero_kills": 0,
        "lane_kills": 0,
        "neutral_kills": 0,
        "ancient_kills": 0,
        "tower_kills": 0,
        "courier_kills": 0,
        "roshan_kills": 0,
        "observer_kills": 0,
        "necronomicon_kills": 0,
        "damage_targets": defaultdict(lambda: defaultdict(int)),
        "damage_inflictor": defaultdict(int),
        "killed": defaultdict(int),
        "killed_by": defaultdict(int),
        "ability_uses": defaultdict(int),
        "item_uses": defaultdict(int),
    } for i in range(10)}

    for line in lines:
        if not line:
            continue
        try:
            event = json.loads(line)
            evt_type = event.get("type")
            
            # Example parsing logic:
            if evt_type == "DOTA_COMBATLOG_DEATH":
                attacker = event.get("attackername")
                target = event.get("targetname")
                # map logic...
                
            elif evt_type == "DOTA_COMBATLOG_PURCHASE":
                pass
                
            # Add more event parsing as needed based on the raw clarity output
            
        except json.JSONDecodeError:
            continue

    # Convert defaultdicts to dicts
    for p in players.values():
        p["gold_reasons"] = dict(p["gold_reasons"])
        p["xp_reasons"] = dict(p["xp_reasons"])
        p["damage_targets"] = {k: dict(v) for k, v in p["damage_targets"].items()}
        p["damage_inflictor"] = dict(p["damage_inflictor"])
        p["killed"] = dict(p["killed"])
        p["killed_by"] = dict(p["killed_by"])
        p["ability_uses"] = dict(p["ability_uses"])
        p["item_uses"] = dict(p["item_uses"])

    return {"players": list(players.values())}
