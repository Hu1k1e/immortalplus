"""
Dota 2 constants: hero data, rank tiers, game modes, items.
Static reference data used across the application.
"""

# Rank tier names mapped to tier IDs
# Rank tiers are encoded as: tens digit = medal, ones digit = stars
# e.g., 71 = Divine 1, 80 = Immortal
RANK_TIERS = {
    0: "Uncalibrated",
    11: "Herald 1", 12: "Herald 2", 13: "Herald 3", 14: "Herald 4", 15: "Herald 5",
    21: "Guardian 1", 22: "Guardian 2", 23: "Guardian 3", 24: "Guardian 4", 25: "Guardian 5",
    31: "Crusader 1", 32: "Crusader 2", 33: "Crusader 3", 34: "Crusader 4", 35: "Crusader 5",
    41: "Archon 1", 42: "Archon 2", 43: "Archon 3", 44: "Archon 4", 45: "Archon 5",
    51: "Legend 1", 52: "Legend 2", 53: "Legend 3", 54: "Legend 4", 55: "Legend 5",
    61: "Ancient 1", 62: "Ancient 2", 63: "Ancient 3", 64: "Ancient 4", 65: "Ancient 5",
    71: "Divine 1", 72: "Divine 2", 73: "Divine 3", 74: "Divine 4", 75: "Divine 5",
    80: "Immortal",
}

# Rank bracket IDs for Stratz API
RANK_BRACKETS = {
    "herald": 1,
    "guardian": 2,
    "crusader": 3,
    "archon": 4,
    "legend": 5,
    "ancient": 6,
    "divine": 7,
    "immortal": 8,
}

# Stratz rank bracket to average MMR (approximate)
RANK_MMR_RANGES = {
    1: (0, 770),        # Herald
    2: (770, 1540),     # Guardian
    3: (1540, 2310),    # Crusader
    4: (2310, 3080),    # Archon
    5: (3080, 3850),    # Legend
    6: (3850, 4620),    # Ancient
    7: (4620, 5420),    # Divine
    8: (5420, 12000),   # Immortal
}

def rank_tier_to_bracket(rank_tier: int) -> int:
    """Convert rank tier (e.g. 45) to bracket (e.g. 4)."""
    if rank_tier is None or rank_tier == 0:
        return 1
    return min(rank_tier // 10, 8)

def get_rank_name(rank_tier: int) -> str:
    """Get human-readable rank name from tier ID."""
    return RANK_TIERS.get(rank_tier, f"Unknown ({rank_tier})")

def get_next_rank_bracket(current_bracket: int) -> int:
    """Get the next rank bracket up."""
    return min(current_bracket + 1, 8)


# Game modes
GAME_MODES = {
    0: "Unknown",
    1: "All Pick",
    2: "Captain's Mode",
    3: "Random Draft",
    4: "Single Draft",
    5: "All Random",
    11: "Mid Only",
    12: "Least Played",
    14: "Compendium",
    16: "Captain's Draft",
    18: "Ability Draft",
    22: "All Pick (Ranked)",
    23: "Turbo",
}

# Lobby types
LOBBY_TYPES = {
    0: "Normal",
    1: "Practice",
    2: "Tournament",
    4: "Co-op Bot",
    5: "Ranked",
    6: "1v1 Mid",
    7: "Ranked",
    9: "Battle Cup",
}

# Lane roles
LANE_ROLES = {
    1: "Safe Lane",
    2: "Mid Lane",
    3: "Off Lane",
    4: "Jungle",
}

# Position/role names
POSITIONS = {
    1: "Hard Carry",
    2: "Mid",
    3: "Offlaner",
    4: "Soft Support",
    5: "Hard Support",
}

# Hero data — full list of all Dota 2 heroes with IDs, names, and primary attribute
# Key: hero_id, Value: {name, localized_name, primary_attr, attack_type, roles, img}
HEROES = {
    1: {"name": "npc_dota_hero_antimage", "localized_name": "Anti-Mage", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    2: {"name": "npc_dota_hero_axe", "localized_name": "Axe", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Durable", "Disabler"]},
    3: {"name": "npc_dota_hero_bane", "localized_name": "Bane", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler", "Nuker"]},
    4: {"name": "npc_dota_hero_bloodseeker", "localized_name": "Bloodseeker", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Jungler"]},
    5: {"name": "npc_dota_hero_crystal_maiden", "localized_name": "Crystal Maiden", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler", "Nuker"]},
    6: {"name": "npc_dota_hero_drow_ranger", "localized_name": "Drow Ranger", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Disabler"]},
    7: {"name": "npc_dota_hero_earthshaker", "localized_name": "Earthshaker", "primary_attr": "str", "attack_type": "Melee", "roles": ["Support", "Initiator", "Disabler"]},
    8: {"name": "npc_dota_hero_juggernaut", "localized_name": "Juggernaut", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Pusher"]},
    9: {"name": "npc_dota_hero_mirana", "localized_name": "Mirana", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Support", "Escape"]},
    10: {"name": "npc_dota_hero_morphling", "localized_name": "Morphling", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Escape", "Nuker"]},
    11: {"name": "npc_dota_hero_nevermore", "localized_name": "Shadow Fiend", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Nuker"]},
    12: {"name": "npc_dota_hero_phantom_lancer", "localized_name": "Phantom Lancer", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    13: {"name": "npc_dota_hero_puck", "localized_name": "Puck", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Initiator", "Disabler", "Escape"]},
    14: {"name": "npc_dota_hero_pudge", "localized_name": "Pudge", "primary_attr": "str", "attack_type": "Melee", "roles": ["Disabler", "Initiator", "Durable"]},
    15: {"name": "npc_dota_hero_razor", "localized_name": "Razor", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Durable", "Nuker"]},
    16: {"name": "npc_dota_hero_sand_king", "localized_name": "Sand King", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler", "Escape"]},
    17: {"name": "npc_dota_hero_storm_spirit", "localized_name": "Storm Spirit", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Escape", "Nuker"]},
    18: {"name": "npc_dota_hero_sven", "localized_name": "Sven", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Disabler", "Initiator"]},
    19: {"name": "npc_dota_hero_tiny", "localized_name": "Tiny", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Nuker", "Disabler"]},
    20: {"name": "npc_dota_hero_vengefulspirit", "localized_name": "Vengeful Spirit", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Support", "Initiator", "Disabler"]},
    21: {"name": "npc_dota_hero_windrunner", "localized_name": "Windranger", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Support", "Disabler"]},
    22: {"name": "npc_dota_hero_zuus", "localized_name": "Zeus", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Nuker"]},
    23: {"name": "npc_dota_hero_kunkka", "localized_name": "Kunkka", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Disabler", "Initiator"]},
    25: {"name": "npc_dota_hero_lina", "localized_name": "Lina", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Support", "Nuker"]},
    26: {"name": "npc_dota_hero_lion", "localized_name": "Lion", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler", "Nuker"]},
    27: {"name": "npc_dota_hero_shadow_shaman", "localized_name": "Shadow Shaman", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Pusher", "Disabler"]},
    28: {"name": "npc_dota_hero_slardar", "localized_name": "Slardar", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Disabler"]},
    29: {"name": "npc_dota_hero_tidehunter", "localized_name": "Tidehunter", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Durable"]},
    30: {"name": "npc_dota_hero_witch_doctor", "localized_name": "Witch Doctor", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    31: {"name": "npc_dota_hero_lich", "localized_name": "Lich", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    32: {"name": "npc_dota_hero_riki", "localized_name": "Riki", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    33: {"name": "npc_dota_hero_enigma", "localized_name": "Enigma", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Initiator", "Jungler", "Disabler"]},
    34: {"name": "npc_dota_hero_tinker", "localized_name": "Tinker", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Pusher"]},
    35: {"name": "npc_dota_hero_sniper", "localized_name": "Sniper", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Nuker"]},
    36: {"name": "npc_dota_hero_necrolyte", "localized_name": "Necrophos", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Durable"]},
    37: {"name": "npc_dota_hero_warlock", "localized_name": "Warlock", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Initiator"]},
    38: {"name": "npc_dota_hero_beastmaster", "localized_name": "Beastmaster", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler"]},
    39: {"name": "npc_dota_hero_queenofpain", "localized_name": "Queen of Pain", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Escape"]},
    40: {"name": "npc_dota_hero_venomancer", "localized_name": "Venomancer", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Pusher"]},
    41: {"name": "npc_dota_hero_faceless_void", "localized_name": "Faceless Void", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Disabler", "Escape"]},
    42: {"name": "npc_dota_hero_skeleton_king", "localized_name": "Wraith King", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable", "Disabler"]},
    43: {"name": "npc_dota_hero_death_prophet", "localized_name": "Death Prophet", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Pusher", "Nuker"]},
    44: {"name": "npc_dota_hero_phantom_assassin", "localized_name": "Phantom Assassin", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    45: {"name": "npc_dota_hero_pugna", "localized_name": "Pugna", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Nuker", "Pusher"]},
    46: {"name": "npc_dota_hero_templar_assassin", "localized_name": "Templar Assassin", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Escape"]},
    47: {"name": "npc_dota_hero_viper", "localized_name": "Viper", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Durable"]},
    48: {"name": "npc_dota_hero_luna", "localized_name": "Luna", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Pusher"]},
    49: {"name": "npc_dota_hero_dragon_knight", "localized_name": "Dragon Knight", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Pusher", "Durable", "Disabler"]},
    50: {"name": "npc_dota_hero_dazzle", "localized_name": "Dazzle", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    51: {"name": "npc_dota_hero_rattletrap", "localized_name": "Clockwerk", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler"]},
    52: {"name": "npc_dota_hero_leshrac", "localized_name": "Leshrac", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Pusher"]},
    53: {"name": "npc_dota_hero_furion", "localized_name": "Nature's Prophet", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Pusher", "Jungler"]},
    54: {"name": "npc_dota_hero_life_stealer", "localized_name": "Lifestealer", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable", "Escape"]},
    55: {"name": "npc_dota_hero_dark_seer", "localized_name": "Dark Seer", "primary_attr": "int", "attack_type": "Melee", "roles": ["Initiator", "Escape"]},
    56: {"name": "npc_dota_hero_clinkz", "localized_name": "Clinkz", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Escape", "Pusher"]},
    57: {"name": "npc_dota_hero_omniknight", "localized_name": "Omniknight", "primary_attr": "str", "attack_type": "Melee", "roles": ["Support", "Durable"]},
    58: {"name": "npc_dota_hero_enchantress", "localized_name": "Enchantress", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Jungler", "Pusher"]},
    59: {"name": "npc_dota_hero_huskar", "localized_name": "Huskar", "primary_attr": "str", "attack_type": "Ranged", "roles": ["Carry", "Durable"]},
    60: {"name": "npc_dota_hero_night_stalker", "localized_name": "Night Stalker", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Initiator"]},
    61: {"name": "npc_dota_hero_broodmother", "localized_name": "Broodmother", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Pusher", "Escape"]},
    62: {"name": "npc_dota_hero_bounty_hunter", "localized_name": "Bounty Hunter", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Escape", "Nuker"]},
    63: {"name": "npc_dota_hero_weaver", "localized_name": "Weaver", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Escape"]},
    64: {"name": "npc_dota_hero_jakiro", "localized_name": "Jakiro", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Pusher", "Disabler"]},
    65: {"name": "npc_dota_hero_batrider", "localized_name": "Batrider", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Initiator", "Disabler", "Escape"]},
    66: {"name": "npc_dota_hero_chen", "localized_name": "Chen", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Jungler", "Pusher"]},
    67: {"name": "npc_dota_hero_spectre", "localized_name": "Spectre", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Durable"]},
    68: {"name": "npc_dota_hero_ancient_apparition", "localized_name": "Ancient Apparition", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler"]},
    69: {"name": "npc_dota_hero_doom_bringer", "localized_name": "Doom", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Disabler", "Durable"]},
    70: {"name": "npc_dota_hero_ursa", "localized_name": "Ursa", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Jungler"]},
    71: {"name": "npc_dota_hero_spirit_breaker", "localized_name": "Spirit Breaker", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Disabler"]},
    72: {"name": "npc_dota_hero_gyrocopter", "localized_name": "Gyrocopter", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Disabler"]},
    73: {"name": "npc_dota_hero_alchemist", "localized_name": "Alchemist", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable", "Disabler"]},
    74: {"name": "npc_dota_hero_invoker", "localized_name": "Invoker", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Disabler", "Escape"]},
    75: {"name": "npc_dota_hero_silencer", "localized_name": "Silencer", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Support", "Disabler"]},
    76: {"name": "npc_dota_hero_obsidian_destroyer", "localized_name": "Outworld Destroyer", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker", "Disabler"]},
    77: {"name": "npc_dota_hero_lycan", "localized_name": "Lycan", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Pusher", "Jungler"]},
    78: {"name": "npc_dota_hero_brewmaster", "localized_name": "Brewmaster", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Durable"]},
    79: {"name": "npc_dota_hero_shadow_demon", "localized_name": "Shadow Demon", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler"]},
    80: {"name": "npc_dota_hero_lone_druid", "localized_name": "Lone Druid", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Pusher", "Durable"]},
    81: {"name": "npc_dota_hero_chaos_knight", "localized_name": "Chaos Knight", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Disabler", "Durable"]},
    82: {"name": "npc_dota_hero_meepo", "localized_name": "Meepo", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape", "Nuker"]},
    83: {"name": "npc_dota_hero_treant", "localized_name": "Treant Protector", "primary_attr": "str", "attack_type": "Melee", "roles": ["Support", "Initiator", "Durable"]},
    84: {"name": "npc_dota_hero_ogre_magi", "localized_name": "Ogre Magi", "primary_attr": "int", "attack_type": "Melee", "roles": ["Support", "Nuker", "Durable", "Disabler"]},
    85: {"name": "npc_dota_hero_undying", "localized_name": "Undying", "primary_attr": "str", "attack_type": "Melee", "roles": ["Support", "Durable"]},
    86: {"name": "npc_dota_hero_rubick", "localized_name": "Rubick", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler", "Nuker"]},
    87: {"name": "npc_dota_hero_disruptor", "localized_name": "Disruptor", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler", "Nuker"]},
    88: {"name": "npc_dota_hero_nyx_assassin", "localized_name": "Nyx Assassin", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Initiator", "Disabler", "Escape"]},
    89: {"name": "npc_dota_hero_naga_siren", "localized_name": "Naga Siren", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Support", "Pusher"]},
    90: {"name": "npc_dota_hero_keeper_of_the_light", "localized_name": "Keeper of the Light", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    91: {"name": "npc_dota_hero_wisp", "localized_name": "Io", "primary_attr": "str", "attack_type": "Ranged", "roles": ["Support", "Escape"]},
    92: {"name": "npc_dota_hero_visage", "localized_name": "Visage", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Pusher"]},
    93: {"name": "npc_dota_hero_slark", "localized_name": "Slark", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    94: {"name": "npc_dota_hero_medusa", "localized_name": "Medusa", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Durable"]},
    95: {"name": "npc_dota_hero_troll_warlord", "localized_name": "Troll Warlord", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Pusher"]},
    96: {"name": "npc_dota_hero_centaur", "localized_name": "Centaur Warrunner", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Durable", "Disabler"]},
    97: {"name": "npc_dota_hero_magnataur", "localized_name": "Magnus", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler", "Escape"]},
    98: {"name": "npc_dota_hero_shredder", "localized_name": "Timbersaw", "primary_attr": "str", "attack_type": "Melee", "roles": ["Nuker", "Durable", "Escape"]},
    99: {"name": "npc_dota_hero_bristleback", "localized_name": "Bristleback", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable"]},
    100: {"name": "npc_dota_hero_tusk", "localized_name": "Tusk", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler"]},
    101: {"name": "npc_dota_hero_skywrath_mage", "localized_name": "Skywrath Mage", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    102: {"name": "npc_dota_hero_abaddon", "localized_name": "Abaddon", "primary_attr": "str", "attack_type": "Melee", "roles": ["Support", "Carry", "Durable"]},
    103: {"name": "npc_dota_hero_elder_titan", "localized_name": "Elder Titan", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler"]},
    104: {"name": "npc_dota_hero_legion_commander", "localized_name": "Legion Commander", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable", "Disabler"]},
    105: {"name": "npc_dota_hero_techies", "localized_name": "Techies", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Nuker", "Disabler"]},
    106: {"name": "npc_dota_hero_ember_spirit", "localized_name": "Ember Spirit", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape", "Nuker"]},
    107: {"name": "npc_dota_hero_earth_spirit", "localized_name": "Earth Spirit", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Disabler", "Escape"]},
    108: {"name": "npc_dota_hero_abyssal_underlord", "localized_name": "Underlord", "primary_attr": "str", "attack_type": "Melee", "roles": ["Durable", "Nuker", "Disabler"]},
    109: {"name": "npc_dota_hero_terrorblade", "localized_name": "Terrorblade", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Pusher"]},
    110: {"name": "npc_dota_hero_phoenix", "localized_name": "Phoenix", "primary_attr": "str", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Initiator"]},
    111: {"name": "npc_dota_hero_oracle", "localized_name": "Oracle", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker"]},
    112: {"name": "npc_dota_hero_winter_wyvern", "localized_name": "Winter Wyvern", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler"]},
    113: {"name": "npc_dota_hero_arc_warden", "localized_name": "Arc Warden", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Carry", "Escape", "Nuker"]},
    114: {"name": "npc_dota_hero_monkey_king", "localized_name": "Monkey King", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Escape"]},
    119: {"name": "npc_dota_hero_dark_willow", "localized_name": "Dark Willow", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Disabler"]},
    120: {"name": "npc_dota_hero_pangolier", "localized_name": "Pangolier", "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Disabler", "Escape"]},
    121: {"name": "npc_dota_hero_grimstroke", "localized_name": "Grimstroke", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Disabler"]},
    123: {"name": "npc_dota_hero_hoodwink", "localized_name": "Hoodwink", "primary_attr": "agi", "attack_type": "Ranged", "roles": ["Nuker", "Escape"]},
    126: {"name": "npc_dota_hero_void_spirit", "localized_name": "Void Spirit", "primary_attr": "int", "attack_type": "Melee", "roles": ["Carry", "Nuker", "Escape"]},
    128: {"name": "npc_dota_hero_snapfire", "localized_name": "Snapfire", "primary_attr": "str", "attack_type": "Ranged", "roles": ["Support", "Nuker", "Disabler"]},
    129: {"name": "npc_dota_hero_mars", "localized_name": "Mars", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Initiator", "Disabler"]},
    131: {"name": "npc_dota_hero_ringmaster", "localized_name": "Ringmaster", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Support", "Disabler"]},
    135: {"name": "npc_dota_hero_dawnbreaker", "localized_name": "Dawnbreaker", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Durable"]},
    136: {"name": "npc_dota_hero_marci", "localized_name": "Marci", "primary_attr": "str", "attack_type": "Melee", "roles": ["Carry", "Support", "Disabler"]},
    137: {"name": "npc_dota_hero_primal_beast", "localized_name": "Primal Beast", "primary_attr": "str", "attack_type": "Melee", "roles": ["Initiator", "Durable", "Disabler"]},
    138: {"name": "npc_dota_hero_muerta", "localized_name": "Muerta", "primary_attr": "int", "attack_type": "Ranged", "roles": ["Carry", "Nuker"]},
}

def get_hero_name(hero_id: int) -> str:
    """Get localized hero name from ID."""
    hero = HEROES.get(hero_id)
    return hero["localized_name"] if hero else f"Unknown Hero ({hero_id})"

def get_hero_image_url(hero_id: int) -> str:
    """Get CDN URL for hero portrait."""
    hero = HEROES.get(hero_id)
    if not hero:
        return ""
    name = hero["name"].replace("npc_dota_hero_", "")
    return f"https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{name}.png"

def get_hero_icon_url(hero_id: int) -> str:
    """Get small hero icon URL."""
    hero = HEROES.get(hero_id)
    if not hero:
        return ""
    name = hero["name"].replace("npc_dota_hero_", "")
    return f"https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/{name}.png"

def get_item_image_url(item_name: str) -> str:
    """Get CDN URL for item icon."""
    return f"https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/{item_name}.png"
