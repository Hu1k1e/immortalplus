import httpx
import logging
import bz2
import json
import asyncio
from config import REPLAY_PARSER_URL

logger = logging.getLogger(__name__)

async def parse_match_locally(match_id: int, cluster_id: int, replay_salt: int) -> dict:
    """
    Downloads the replay from Valve, unzips it, and sends it to the local OpenDota parser container.
    """
    # 1. Download replay from Valve
    # http://replay{cluster}.valve.net/570/{match_id}_{salt}.dem.bz2
    # e.g. http://replay273.valve.net/570/7503212404_1277518156.dem.bz2
    url = f"http://replay{cluster_id}.valve.net/570/{match_id}_{replay_salt}.dem.bz2"
    logger.info(f"Downloading replay for {match_id} from {url}")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Note: We can also use the /blob endpoint on the parser, but it's safer to download it here
            # and POST the decompressed bytes to avoid parser timeout issues.
            response = await client.get(url)
            if response.status_code != 200:
                logger.error(f"Failed to download replay: {response.status_code}")
                return None
                
            compressed_data = response.content
            logger.info(f"Downloaded {len(compressed_data)} bytes. Decompressing...")
            
            dem_data = bz2.decompress(compressed_data)
            logger.info(f"Decompressed to {len(dem_data)} bytes. Sending to local parser...")
            
            # Send to local parser
            # The parser container is running odota/parser on port 5600
            parser_url = "http://replay_parser:5600/"
            # Ensure URL from config
            if REPLAY_PARSER_URL:
                parser_url = REPLAY_PARSER_URL
                
            # OpenDota parser expects a POST with binary data
            parse_response = await client.post(parser_url, content=dem_data, headers={"Content-Type": "application/octet-stream"})
            
            if parse_response.status_code != 200:
                logger.error(f"Parser returned error: {parse_response.status_code}")
                return None
                
            # The parser outputs newline delimited JSON (JSON Lines).
            # We need to process this stream into a single match object exactly like OpenDota does,
            # or just take the parse output. 
            # Wait, OpenDota's parser outputs an array of events (JSONLines).
            # If we just want the fully aggregated match data, we need the `compute.ts` logic!
            # Let's try to just hit the parser and see what it outputs.
            logger.info(f"Parse successful for {match_id}")
            return parse_response.text
            
        except Exception as e:
            logger.error(f"Local parse failed for {match_id}: {e}")
            return None
