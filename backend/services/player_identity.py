"""
Persona name / avatar resolution across every source this app has a client
for. Stratz is tried FIRST (the primary source, per explicit request) —
it maintains its own cache of the linked Steam account independent of
OpenDota's, and OpenDota's own /players/{id} response has been observed
returning "profile" with personaname/avatarfull/profileurl keys PRESENT
but explicitly null for accounts it hasn't fully cached persona data for
yet. OpenDota's profile (already fetched by the caller for rank_tier/mmr
anyway) is the second source, and the Steam Web API directly (the ultimate
source of truth, works even for accounts neither of the above has indexed)
is the last resort. All three are best-effort — a failure in any one just
leaves that field for the next source to try, never raises.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def resolve_persona_avatar(
    account_id: int,
    steamid64: str,
    opendota_profile: dict,
    settings,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    persona_name: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None

    if settings and getattr(settings, "stratz_api_token", None):
        try:
            from services.stratz import get_stratz_client
            stratz_client = get_stratz_client(settings.stratz_api_token)
            if stratz_client:
                summary = await stratz_client.get_player_profile(account_id)
                if summary:
                    persona_name = summary.get("personaname")
                    avatar_url = summary.get("avatarfull")
                    profile_url = summary.get("profileurl")
        except Exception as e:
            logger.info(f"Stratz profile lookup failed for {account_id}: {e}")

    opendota_profile = opendota_profile or {}
    persona_name = persona_name or opendota_profile.get("personaname")
    avatar_url = avatar_url or opendota_profile.get("avatarfull")
    profile_url = profile_url or opendota_profile.get("profileurl")

    if (not persona_name or not avatar_url) and settings and getattr(settings, "steam_api_key", None):
        try:
            from services.steam import SteamClient
            summary = await SteamClient(settings.steam_api_key).get_player_summary(steamid64)
            if summary:
                persona_name = persona_name or summary.get("personaname")
                avatar_url = avatar_url or summary.get("avatarfull")
                profile_url = profile_url or summary.get("profileurl")
        except Exception as e:
            logger.info(f"Steam API profile fallback failed for {steamid64}: {e}")

    return persona_name, avatar_url, profile_url
