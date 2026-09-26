"""
Local replay parser service.

Downloads the replay file from Valve's CDN and sends the decompressed
.dem bytes to the local odota/parser Docker container.

IMPORTANT: Valve switched from bz2 → zstd compression around 2024.
The file is still named .dem.bz2 but magic bytes 28 B5 2F FD = zstd.
We auto-detect compression by magic bytes and decompress accordingly.
"""

import bz2
import io
import logging
from typing import Optional

import httpx

from config import REPLAY_PARSER_URL

logger = logging.getLogger(__name__)

# zstd magic bytes: 0x28 0xB5 0x2F 0xFD
_ZSTD_MAGIC = b'\x28\xb5\x2f\xfd'
# bz2 magic bytes: 0x42 0x5A 0x68 (BZh)
_BZ2_MAGIC = b'BZh'


def _decompress(data: bytes) -> Optional[bytes]:
    """
    Auto-detect compression format by magic bytes and decompress.
    Returns raw .dem bytes, or None on failure.
    """
    if data[:4] == _ZSTD_MAGIC:
        # zstd — use streaming decompressor (handles unknown content size)
        try:
            import zstandard
            dctx = zstandard.ZstdDecompressor()
            with dctx.stream_reader(io.BytesIO(data)) as reader:
                return reader.read()
        except Exception as e:
            logger.error(f"zstd decompression failed: {e}")
            return None

    elif data[:3] == _BZ2_MAGIC:
        # Legacy bz2 format
        try:
            return bz2.decompress(data)
        except Exception as e:
            logger.error(f"bz2 decompression failed: {e}")
            return None

    else:
        # Unknown — assume already decompressed or raw .dem
        logger.warning(f"Unknown compression magic: {data[:4].hex()} — trying raw")
        return data


async def parse_match_locally(match_id: int, cluster_id: int, replay_salt: int) -> Optional[str]:
    """
    Downloads the replay from Valve CDN, decompresses it, and sends
    the raw .dem bytes to the local odota/parser container.

    Returns the parser's raw JSONL output string, or None on any failure.
    """
    url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"
    logger.info(f"Downloading replay for {match_id} from {url}")

    # Use separate clients with different timeouts
    async with httpx.AsyncClient(timeout=180.0) as download_client:
        try:
            response = await download_client.get(
                url,
                headers={"User-Agent": "ImmortalPlus/1.0"},
            )
            if response.status_code != 200:
                logger.error(f"[{match_id}] Valve CDN returned {response.status_code}")
                return None

            compressed = response.content
            compression_type = "zstd" if compressed[:4] == _ZSTD_MAGIC else "bz2"
            logger.info(
                f"[{match_id}] Downloaded {len(compressed):,} bytes "
                f"(format: {compression_type}). Decompressing..."
            )

            dem_data = _decompress(compressed)
            if not dem_data:
                logger.error(f"[{match_id}] Decompression returned no data")
                return None

            logger.info(
                f"[{match_id}] Decompressed to {len(dem_data):,} bytes. "
                f"Sending to local parser..."
            )

        except Exception as e:
            logger.error(f"[{match_id}] Download/decompress failed: {e}")
            return None

    # Send decompressed .dem bytes to the odota/parser container
    # Use a fresh client with a generous timeout (large replays take time)
    parser_url = REPLAY_PARSER_URL or "http://replay-parser:5600/"
    # Ensure URL has trailing slash / correct path
    if not parser_url.endswith("/"):
        parser_url = parser_url + "/"

    async with httpx.AsyncClient(timeout=300.0) as parse_client:
        try:
            parse_response = await parse_client.post(
                parser_url,
                content=dem_data,
                headers={"Content-Type": "application/octet-stream"},
            )

            if parse_response.status_code != 200:
                logger.error(
                    f"[{match_id}] Parser container returned {parse_response.status_code}: "
                    f"{parse_response.text[:200]}"
                )
                return None

            logger.info(f"[{match_id}] Local parse successful")
            return parse_response.text

        except httpx.ConnectError as e:
            logger.error(
                f"[{match_id}] Cannot connect to parser container at {parser_url}. "
                f"Is odota/parser running? Error: {e}"
            )
            return None
        except Exception as e:
            logger.error(f"[{match_id}] Parser request failed: {e}")
            return None
