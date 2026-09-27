"""
One-off diagnostic: dumps the first few raw "interval" JSON lines from the
replay_parser's raw stream for a real match, so we can see exactly what
fields it actually returns (does "hp"/"mana" appear at all? null? a real
number?) instead of guessing from vitals_parser.py's already-processed
output.

Usage (run inside the backend container, which already has httpx and
network access to replay_parser):
    python3 _debug_vitals_raw.py <match_id> <cluster> <replay_salt>

Example, using the match/cluster/salt already seen in this deploy's logs:
    python3 _debug_vitals_raw.py 9017998197 122 1723844405
"""
import asyncio
import bz2
import io
import json
import sys

import httpx

from config import REPLAY_PARSER_URL

_ZSTD_MAGIC = b'\x28\xb5\x2f\xfd'
_BZ2_MAGIC = b'BZh'


def _decompress(data: bytes):
    if data[:4] == _ZSTD_MAGIC:
        import zstandard
        dctx = zstandard.ZstdDecompressor()
        with dctx.stream_reader(io.BytesIO(data)) as reader:
            return reader.read()
    elif data[:3] == _BZ2_MAGIC:
        return bz2.decompress(data)
    return data


async def main(match_id: int, cluster_id: int, replay_salt: int):
    url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"
    print(f"Downloading {url} ...")
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.get(url, headers={"User-Agent": "ImmortalPlus/1.0"})
        resp.raise_for_status()
        dem_data = _decompress(resp.content)
    print(f"Decompressed {len(dem_data)} bytes. POSTing to parser...")

    parser_base = (REPLAY_PARSER_URL or "http://replay_parser:5600").rstrip("/")
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(parser_base + "/", content=dem_data, headers={"Content-Type": "application/octet-stream"})
        resp.raise_for_status()
        raw_text = resp.text

    print(f"Got {len(raw_text)} chars of raw output. Scanning for interval entries...\n")

    shown = 0
    all_keys_seen = set()
    hp_present_count = 0
    hp_nonnull_count = 0
    total_interval = 0

    for line in raw_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "interval":
            continue
        total_interval += 1
        all_keys_seen.update(entry.keys())
        if "hp" in entry:
            hp_present_count += 1
            if entry.get("hp") is not None:
                hp_nonnull_count += 1
        if shown < 5 and entry.get("slot") is not None:
            print(f"--- interval entry #{shown} ---")
            print(json.dumps(entry, indent=2))
            shown += 1

    print(f"\nTotal interval entries: {total_interval}")
    print(f"Entries with 'hp' key present at all: {hp_present_count}")
    print(f"Entries where 'hp' was non-null: {hp_nonnull_count}")
    print(f"\nAll distinct keys seen across every interval entry:")
    print(sorted(all_keys_seen))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 _debug_vitals_raw.py <match_id> <cluster> <replay_salt>")
        sys.exit(1)
    asyncio.run(main(int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])))
