// Labels for OpenDota's numeric game_mode/lobby_type/region codes — small
// enough to inline rather than fetch a constants file for. Only the common
// ones are named; anything else falls back gracefully.

const GAME_MODES: Record<number, string> = {
  1: 'All Pick',
  2: 'Captains Mode',
  3: 'Random Draft',
  4: 'Single Draft',
  5: 'All Random',
  16: 'Captains Draft',
  18: 'Ability Draft',
  22: 'All Pick',
  23: 'Turbo',
};

const LOBBY_TYPES: Record<number, string> = {
  0: 'Unranked',
  1: 'Practice',
  2: 'Tournament',
  5: 'Team Match',
  6: 'Solo Queue',
  7: 'Ranked',
  9: '1v1 Mid',
};

const REGIONS: Record<number, string> = {
  1: 'US West', 2: 'US East', 3: 'Europe', 5: 'Singapore', 6: 'Dubai',
  7: 'Australia', 8: 'Stockholm', 9: 'Austria', 10: 'Brazil', 11: 'South Africa',
  12: 'Shanghai', 13: 'China Unicom', 14: 'Chile', 15: 'Peru', 16: 'India',
  17: 'Guangdong', 18: 'Zhejiang', 19: 'Japan', 20: 'Wuhan', 25: 'Tianjin',
  37: 'Taiwan', 38: 'Argentina',
};

export function getGameModeLabel(gameMode?: number | null): string | null {
  if (gameMode == null) return null;
  return GAME_MODES[gameMode] || null;
}

export function getLobbyTypeLabel(lobbyType?: number | null): string | null {
  if (lobbyType == null) return null;
  return LOBBY_TYPES[lobbyType] || null;
}

export function getRegionLabel(region?: number | null): string | null {
  if (region == null) return null;
  return REGIONS[region] || null;
}
