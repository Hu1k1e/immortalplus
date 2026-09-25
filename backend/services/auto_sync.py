import asyncio
import logging
from sqlalchemy.orm import Session
from sqlmodel import select
import time

from database import engine
from models import UserSettings, Player
from services.sync import sync_player_matches, fetch_match_details

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def auto_sync_loop():
    logger.info("Starting automatic background match sync & parse service...")
    while True:
        try:
            with Session(engine) as session:
                settings = session.exec(select(UserSettings)).first()
                if not settings or not settings.auto_parse_replays:
                    await asyncio.sleep(60)
                    continue

                players = session.exec(select(Player)).all()
                for player in players:
                    # Sync new matches
                    new_count = await sync_player_matches(session, player, settings)
                    if new_count > 0:
                        logger.info(f"Auto-synced {new_count} new matches for player {player.account_id}")
                        # Immediately fetch details for the new matches (this includes parsing!)
                        from models import Match
                        unparsed_matches = session.exec(
                            select(Match)
                            .where(Match.player_id == player.id)
                            .where(Match.opendota_raw == None)
                            .order_by(Match.match_id.desc())
                            .limit(new_count)
                        ).all()

                        for m in unparsed_matches:
                            logger.info(f"Fetching deep details for match {m.match_id}")
                            success = await fetch_match_details(session, m, settings)
                            if success:
                                session.commit()
                                logger.info(f"Successfully fetched and parsed deep stats for {m.match_id}")
                            else:
                                logger.warning(f"Failed to fetch details for {m.match_id} (maybe parse is still pending)")

        except Exception as e:
            logger.error(f"Error in auto sync loop: {e}")
        
        # Poll every 5 minutes (300 seconds)
        await asyncio.sleep(300)

if __name__ == "__main__":
    asyncio.run(auto_sync_loop())
