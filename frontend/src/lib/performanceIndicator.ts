/**
 * Client-side approximation of Stratz's per-player "Performance Score"
 * badge (the signed number + bar shown on each Matchup card, e.g. "+30"
 * with a "Very High Performance" hover label). Stratz's real algorithm is
 * proprietary and unreachable (Cloudflare-protected API) — this is a
 * documented heuristic blending KDA, GPM/XPM, and net worth into a
 * percentile among the 10 players, rescaled to roughly Stratz's observed
 * -50..+50 range, with matching tier labels.
 */
export interface PerformanceResult {
  score: number; // roughly -50..+50, centered on 0
  label: string;
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

export function getPerformanceLabel(score: number): string {
  if (score >= 30) return 'Very High Performance';
  if (score >= 15) return 'High Performance';
  if (score >= 5) return 'Above Average Performance';
  if (score > -5) return 'Average Performance';
  if (score > -15) return 'Below Average Performance';
  if (score > -30) return 'Low Performance';
  return 'Very Low Performance';
}

export function computePerformanceScore(player: any, allPlayers: any[]): PerformanceResult {
  if (!player || !allPlayers || allPlayers.length < 2) {
    return { score: 0, label: 'Average Performance', color: 'var(--text-muted)' };
  }

  const scored = allPlayers.map((p) => ({ slot: p.player_slot, score: rawScore(p) }));
  scored.sort((a, b) => a.score - b.score);
  const idx = scored.findIndex((s) => s.slot === player.player_slot);
  if (idx === -1) return { score: 0, label: 'Average Performance', color: 'var(--text-muted)' };

  const percentile = (idx / (scored.length - 1)) * 100;
  const score = Math.round(percentile - 50);
  const label = getPerformanceLabel(score);

  let color = 'var(--text-muted)';
  if (score >= 15) color = 'var(--radiant-green)';
  else if (score <= -15) color = 'var(--dire-red)';

  return { score, label, color };
}
