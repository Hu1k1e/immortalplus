// OpenDota lane_role scale: 1 Safe Lane, 2 Mid Lane, 3 Off Lane, 4 Jungle.
// Not the same as position (1-5) — position_est isn't computed anywhere in
// this app's pipeline, so lane_role is the best signal actually available
// per player.
export interface RoleInfo {
  label: string;
  short: string;
  color: string;
}

const ROLE_MAP: Record<number, RoleInfo> = {
  1: { label: 'Safe Lane', short: 'SAFE', color: '#51a445' },
  2: { label: 'Mid Lane', short: 'MID', color: '#e2b742' },
  3: { label: 'Off Lane', short: 'OFF', color: '#c2352b' },
  4: { label: 'Jungle', short: 'JNG', color: '#8b6bd8' },
};

export function getRoleInfo(laneRole?: number | null): RoleInfo | null {
  if (laneRole == null) return null;
  return ROLE_MAP[laneRole] || null;
}

export interface PositionInfo {
  pos: number;
  label: string;
  short: string;
}

export const POSITION_INFO: Record<number, PositionInfo> = {
  1: { pos: 1, label: 'Position 1 — Carry', short: 'CARRY' },
  2: { pos: 2, label: 'Position 2 — Mid', short: 'MID' },
  3: { pos: 3, label: 'Position 3 — Offlane', short: 'OFF' },
  4: { pos: 4, label: 'Position 4 — Soft Support', short: 'SOFT4' },
  5: { pos: 5, label: 'Position 5 — Hard Support', short: 'HARD5' },
};

/**
 * Estimate positions 1-5 for one team's 5 players. No draft-order or
 * explicit position field exists anywhere in this app's data pipeline, so
 * this is a documented heuristic, not a real reconstruction: the unique
 * lane_role===2 (Mid Lane) player is Position 2; the remaining four are
 * ranked by end-of-game net worth, highest to lowest, and assigned Carry (1)
 * > Offlane (3) > Soft Support (4) > Hard Support (5) in that order — the
 * same convention many stat sites fall back to without real position data.
 */
export function estimateTeamPositions(teamPlayers: any[]): Map<number, number> {
  const result = new Map<number, number>();
  if (!teamPlayers || teamPlayers.length === 0) return result;

  const netWorthOf = (p: any) => p.net_worth ?? p.networth ?? 0;
  const midCandidates = teamPlayers.filter((p) => p.lane_role === 2);
  let mid: any = null;
  if (midCandidates.length === 1) mid = midCandidates[0];
  else if (midCandidates.length > 1) mid = midCandidates.reduce((a: any, b: any) => (netWorthOf(a) >= netWorthOf(b) ? a : b));

  const rest = teamPlayers.filter((p) => p !== mid).sort((a, b) => netWorthOf(b) - netWorthOf(a));
  const order = [1, 3, 4, 5];
  rest.forEach((p, i) => {
    if (order[i]) result.set(p.player_slot, order[i]);
  });
  if (mid) result.set(mid.player_slot, 2);

  return result;
}
