import dotaconstants from 'dotaconstants';

// Real cumulative-XP-per-level table (dotaconstants' xp_level, the same
// constants data OpenDota's own frontend ships) — lets a hero's live level
// be derived from real cumulative XP (xp_t) instead of guessed/scaled.
const XP_LEVEL: number[] = (dotaconstants as any).xp_level || [];

export function levelFromXp(xp: number): number {
  if (!XP_LEVEL.length) return 1;
  let level = 1;
  for (let i = 1; i < XP_LEVEL.length; i++) {
    if (xp >= XP_LEVEL[i]) level = i + 1;
    else break;
  }
  return level;
}
