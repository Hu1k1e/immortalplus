"""
Application configuration.
All sensitive config is stored in the database via Settings UI.
This module handles environment-level config (ports, paths) only.
"""

import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
REPLAYS_DIR = Path(os.getenv("REPLAYS_DIR", BASE_DIR / "replays"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'immortalplus.db'}")

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
REPLAYS_DIR.mkdir(parents=True, exist_ok=True)

# Server
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:9485")
REPLAY_PARSER_URL = os.getenv("REPLAY_PARSER_URL", "http://localhost:5600")

# GSI
GSI_PORT = int(os.getenv("GSI_PORT", "9487"))

# API defaults (overridden by user settings in DB)
OPENDOTA_BASE_URL = "https://api.opendota.com/api"
STRATZ_BASE_URL = "https://api.stratz.com/graphql"
STEAM_API_BASE_URL = "https://api.steampowered.com"
PROTRACKER_BASE_URL = "https://www.dota2protracker.com"

# Rate limiting defaults
OPENDOTA_RATE_LIMIT = 60          # requests per minute
OPENDOTA_MONTHLY_LIMIT = 50000    # requests per month
STRATZ_DAILY_LIMIT = 100000       # matches per day

# Cache TTL defaults (seconds)
CACHE_TTL_META = 6 * 3600         # 6 hours for meta data
CACHE_TTL_MATCH = 24 * 3600       # 24 hours for match data
CACHE_TTL_PLAYER = 1800           # 30 minutes for player data
CACHE_TTL_HERO_MATCHUPS = 12 * 3600  # 12 hours for hero matchups
