"""
Parser aggregator for odota/parser output.

The odota/parser (Java Clarity service) outputs newline-delimited JSON (JSONL).
Each line is a JSON object representing the full parsed match in OpenDota format.
The last non-empty line is typically the complete aggregated match object.

This module extracts the final aggregated output and merges it with the 
OpenDota API match object to produce enriched match data.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def aggregate_parser_output(json_lines: str, account_id_to_slot: dict) -> Optional[dict]:
    """
    Parse the JSONL output from odota/parser.

    The parser outputs multiple JSON objects as newline-delimited JSON.
    The structure is the OpenDota match format with players array containing
    deep fields like purchase_log, kills_log, obs_log, sen_log, gold_t, etc.

    Returns the parsed match dict, or None if parsing fails.
    """
    if not json_lines:
        logger.error("aggregate_parser_output: empty input")
        return None

    lines = [line.strip() for line in json_lines.strip().split('\n') if line.strip()]
    if not lines:
        logger.error("aggregate_parser_output: no non-empty lines")
        return None

    logger.info(f"aggregate_parser_output: processing {len(lines)} JSON lines from parser")

    # Strategy: odota/parser emits one complete JSON object per line.
    # The last line is usually the full aggregated match data.
    # Try lines from last to first until we find a valid complete match object.
    parsed_data = None
    for line in reversed(lines):
        try:
            obj = json.loads(line)
            # A valid match object has a "players" array with at least one player
            if isinstance(obj, dict) and obj.get("players") and len(obj["players"]) > 0:
                parsed_data = obj
                break
        except json.JSONDecodeError:
            continue

    if not parsed_data:
        # Fallback: try the first line that looks like a match
        for line in lines:
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and "players" in obj:
                    parsed_data = obj
                    break
            except json.JSONDecodeError:
                continue

    if not parsed_data:
        logger.error(
            f"aggregate_parser_output: could not find a valid match object in {len(lines)} lines. "
            f"First line preview: {lines[0][:200] if lines else 'empty'}"
        )
        return None

    player_count = len(parsed_data.get("players", []))
    has_purchase = any(p.get("purchase_log") for p in parsed_data.get("players", []))
    has_kills = any(p.get("kills_log") for p in parsed_data.get("players", []))
    has_obs = any(p.get("obs_log") for p in parsed_data.get("players", []))

    logger.info(
        f"aggregate_parser_output: extracted match with {player_count} players, "
        f"purchase_log={has_purchase}, kills_log={has_kills}, obs_log={has_obs}"
    )

    return parsed_data
