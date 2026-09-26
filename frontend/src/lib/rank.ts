// Rank medal images. Different host from lib/dota.ts's CDN_BASE (cdn.cloudflare.steamstatic.com) —
// keep separate rather than folding into it.
const RANK_CDN_BASE = 'https://www.opendota.com/assets/images/dota2/rank_icons';

/**
 * Get the rank medal image URL for a player's rank_tier (OpenDota scale:
 * tens digit = rank name 0-8 Uncalibrated..Immortal, ones digit = star 1-5).
 * Only the medal (no star count) is available at this CDN. Returns null when
 * rank_tier is absent so callers can omit the badge entirely — rank_tier is
 * not reliably present for every player in a match.
 */
export function getRankBadge(rankTier?: number | null): string | null {
  if (rankTier == null || isNaN(rankTier) || rankTier <= 0) return null;
  const tier = Math.max(0, Math.min(8, Math.floor(rankTier / 10)));
  return `${RANK_CDN_BASE}/rank_icon_${tier}.png`;
}
