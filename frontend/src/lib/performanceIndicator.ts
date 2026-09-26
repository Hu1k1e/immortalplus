/**
 * Client-side approximation of a per-player "how well did they do relative
 * to the other 9 people in this match" indicator, inspired by Stratz's
 * colored performance dot. This is NOT a port of Stratz's real (proprietary,
 * unpublished) algorithm — it's a documented heuristic blending KDA,
 * GPM/XPM, and net worth, all already available per player in `all_players`.
 * Returns a percentile within the match (0-100) and a color to render it.
 */
export interface PerformanceResult {
  percentile: number;
  color: string;
}

function rawScore(p: any): number {
  const kills = p.kills || 0;
  const deaths = p.deaths || 0;
  const assists = p.assists || 0;
  const kda = (kills + assists) / Math.max(1, deaths);
  const gpm = p.gold_per_min ?? p.gpm ?? 0;
  const xpm = p.xp_per_min ?? p.xpm ?? 0;
  const netWorth = p.net_worth ?? p.networth ?? 0;
  return kda * 8 + gpm * 0.05 + xpm * 0.03 + netWorth * 0.002;
}

export function computePerformanceScore(player: any, allPlayers: any[]): PerformanceResult {
  if (!player || !allPlayers || allPlayers.length < 2) {
    return { percentile: 50, color: 'var(--text-muted)' };
  }

  const scored = allPlayers.map((p) => ({ slot: p.player_slot, score: rawScore(p) }));
  scored.sort((a, b) => a.score - b.score);
  const idx = scored.findIndex((s) => s.slot === player.player_slot);
  if (idx === -1) return { percentile: 50, color: 'var(--text-muted)' };

  const percentile = (idx / (scored.length - 1)) * 100;
  let color = 'var(--accent-gold)';
  if (percentile >= 65) color = 'var(--radiant-green)';
  else if (percentile <= 35) color = 'var(--dire-red)';

  return { percentile: Math.round(percentile), color };
}
