"""
SQLModel ORM definitions for all database tables.
"""

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Player(SQLModel, table=True):
    __tablename__ = "players"

    id: Optional[int] = Field(default=None, primary_key=True)
    steam_id: str = Field(unique=True, index=True)
    account_id: Optional[int] = Field(default=None, index=True)
    persona_name: Optional[str] = None
    avatar_url: Optional[str] = None
    rank_tier: Optional[int] = None
    mmr_estimate: Optional[int] = None
    profile_url: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Match(SQLModel, table=True):
    __tablename__ = "matches"

    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: int = Field(unique=True, index=True)
    player_id: Optional[int] = Field(default=None, foreign_key="players.id")
    hero_id: int
    result: Optional[str] = None  # 'win' or 'loss'
    game_mode: Optional[int] = None
    lobby_type: Optional[int] = None
    duration: Optional[int] = None
    kills: Optional[int] = None
    deaths: Optional[int] = None
    assists: Optional[int] = None
    gpm: Optional[int] = None
    xpm: Optional[int] = None
    hero_damage: Optional[int] = None
    tower_damage: Optional[int] = None
    hero_healing: Optional[int] = None
    last_hits: Optional[int] = None
    denies: Optional[int] = None
    level: Optional[int] = None
    lane: Optional[int] = None
    lane_role: Optional[int] = None
    items: Optional[str] = None         # JSON array
    backpack: Optional[str] = None      # JSON array
    neutral_item: Optional[int] = None
    gold_t: Optional[str] = None        # JSON array: gold per minute
    xp_t: Optional[str] = None          # JSON array: xp per minute
    lh_t: Optional[str] = None          # JSON array: last hits per minute
    dn_t: Optional[str] = None          # JSON array: denies per minute
    benchmarks: Optional[str] = None    # JSON object
    purchase_log: Optional[str] = None  # JSON array
    kills_log: Optional[str] = None     # JSON array
    runes_log: Optional[str] = None     # JSON array
    obs_log: Optional[str] = None       # JSON: observer ward log
    sen_log: Optional[str] = None       # JSON: sentry ward log
    teamfights: Optional[str] = None    # JSON array
    objectives: Optional[str] = None    # JSON array
    party_size: Optional[int] = None
    is_parsed: bool = Field(default=False)
    is_analyzed: bool = Field(default=False)
    rank_tier: Optional[int] = None
    avg_rank_tier: Optional[int] = None
    player_slot: Optional[int] = None
    radiant_win: Optional[bool] = None
    all_players: Optional[str] = None   # JSON: all 10 players summary
    played_at: Optional[datetime] = None
    synced_at: datetime = Field(default_factory=datetime.utcnow)


class ParsedReplay(SQLModel, table=True):
    __tablename__ = "parsed_replays"

    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: int = Field(unique=True, index=True)
    replay_url: Optional[str] = None
    parse_status: str = Field(default="pending")  # pending, parsing, done, failed
    hero_positions: Optional[str] = None    # JSON
    combat_log: Optional[str] = None        # JSON
    ward_log: Optional[str] = None          # JSON
    item_timings: Optional[str] = None      # JSON
    teamfights: Optional[str] = None        # JSON
    smoke_usage: Optional[str] = None       # JSON
    rune_pickups: Optional[str] = None      # JSON
    error_msg: Optional[str] = None
    parsed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MatchAnalysis(SQLModel, table=True):
    __tablename__ = "match_analysis"

    id: Optional[int] = Field(default=None, primary_key=True)
    match_id: int = Field(index=True)
    player_id: Optional[int] = Field(default=None, foreign_key="players.id")

    # Laning phase
    laning_score: Optional[float] = None
    cs_at_10: Optional[int] = None
    cs_benchmark_rank: Optional[float] = None
    lane_kills: Optional[int] = None
    lane_deaths: Optional[int] = None

    # Overall scores (0-100)
    performance_score: Optional[float] = None
    farming_score: Optional[float] = None
    fighting_score: Optional[float] = None
    vision_score: Optional[float] = None
    objective_score: Optional[float] = None
    death_score: Optional[float] = None

    # Rank comparisons
    rank_comparison: Optional[str] = None   # JSON

    # Action items
    action_items: Optional[str] = None      # JSON array

    # Mistakes
    mistakes: Optional[str] = None          # JSON array

    # Phase breakdowns
    laning_analysis: Optional[str] = None   # JSON
    midgame_analysis: Optional[str] = None  # JSON
    lategame_analysis: Optional[str] = None # JSON
    
    # AI Coaching Results
    ai_coaching: Optional[str] = None       # JSON

    analyzed_at: datetime = Field(default_factory=datetime.utcnow)


class ProgressSnapshot(SQLModel, table=True):
    __tablename__ = "progress_snapshots"

    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: Optional[int] = Field(default=None, foreign_key="players.id")
    snapshot_date: str  # 'YYYY-MM-DD'
    period_type: str = "daily"  # daily, weekly
    matches_played: int = 0
    wins: int = 0
    avg_kda: Optional[float] = None
    avg_gpm: Optional[float] = None
    avg_xpm: Optional[float] = None
    avg_cs_min: Optional[float] = None
    avg_deaths: Optional[float] = None
    avg_hero_damage: Optional[float] = None
    avg_tower_damage: Optional[float] = None
    avg_wards: Optional[float] = None
    mmr_estimate: Optional[int] = None
    rank_tier: Optional[int] = None
    improvement_score: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HeroMeta(SQLModel, table=True):
    __tablename__ = "hero_meta"

    id: Optional[int] = Field(default=None, primary_key=True)
    hero_id: int = Field(index=True)
    rank_bracket: Optional[int] = None  # 0-8
    patch: Optional[str] = None
    pick_count: int = 0
    win_count: int = 0
    ban_count: int = 0
    winrate: Optional[float] = None
    pickrate: Optional[float] = None
    avg_gpm: Optional[float] = None
    avg_xpm: Optional[float] = None
    avg_kda: Optional[float] = None
    popular_items: Optional[str] = None     # JSON
    popular_skills: Optional[str] = None    # JSON
    updated_at: Optional[datetime] = None


class HeroMatchup(SQLModel, table=True):
    __tablename__ = "hero_matchups"

    id: Optional[int] = Field(default=None, primary_key=True)
    hero_id: int = Field(index=True)
    enemy_hero_id: int = Field(index=True)
    games_played: int = 0
    wins: int = 0
    advantage: Optional[float] = None  # positive = good matchup
    rank_bracket: Optional[int] = None
    updated_at: Optional[datetime] = None


class ProMeta(SQLModel, table=True):
    __tablename__ = "pro_meta"

    id: Optional[int] = Field(default=None, primary_key=True)
    hero_id: int = Field(index=True)
    hero_name: Optional[str] = None
    player_name: Optional[str] = None
    matches_played: Optional[int] = None
    winrate: Optional[float] = None
    avg_kda: Optional[float] = None
    common_items: Optional[str] = None      # JSON
    skill_build: Optional[str] = None       # JSON
    lane_preference: Optional[str] = None
    scraped_at: Optional[datetime] = None


class ActionItem(SQLModel, table=True):
    __tablename__ = "action_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: Optional[int] = Field(default=None, foreign_key="players.id")
    match_id: Optional[int] = None
    text: str
    category: Optional[str] = None  # farming, fighting, vision, positioning, itemization
    difficulty: Optional[str] = None  # easy, medium, hard
    priority: int = 0
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSettings(SQLModel, table=True):
    __tablename__ = "user_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: Optional[int] = Field(default=None, unique=True)

    # API Keys
    steam_api_key: Optional[str] = None
    opendota_api_key: Optional[str] = None
    stratz_api_token: Optional[str] = None
    
    # LLM Settings
    openai_api_key: Optional[str] = None
    openai_api_base: Optional[str] = None
    openai_model: Optional[str] = None

    # Player preferences
    theme: str = "default"
    primary_role: Optional[str] = None
    preferred_heroes: Optional[str] = None  # JSON array
    target_rank: Optional[int] = None
    current_rank: Optional[int] = None

    # Sync
    auto_sync_matches: bool = True
    sync_interval_minutes: int = 30
    auto_parse_replays: bool = False
    replay_storage_limit_gb: int = 50

    # Analysis
    analysis_depth: str = "standard"        # basic, standard, deep
    benchmark_target: str = "next_rank"     # next_rank, divine, immortal, pro
    include_turbo: bool = False
    include_ability_draft: bool = False
    min_hero_games: int = 10

    # Draft helper
    gsi_enabled: bool = False
    gsi_port: int = 9487
    draft_min_comfort_games: int = 10
    draft_show_meta_tier: bool = True
    draft_priority: str = "balanced"        # counterpick, comfort, meta, balanced

    # ProTracker
    protracker_enabled: bool = True
    protracker_interval_hours: int = 6

    # Appearance
    animation_speed: str = "normal"         # reduced, normal, enhanced
    sidebar_position: str = "left"
    dashboard_layout: str = "comfortable"   # compact, comfortable, spacious
    graph_style: str = "area"               # line, area, smooth
    font_size: str = "medium"               # small, medium, large

    # Advanced
    log_level: str = "info"
    cache_ttl_hours: int = 6

    updated_at: Optional[datetime] = None
