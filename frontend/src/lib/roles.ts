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
