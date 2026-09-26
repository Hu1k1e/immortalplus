// Minimal glyphs standing in for Stratz's position badges — not a literal
// asset match, just a same-shape-language approximation per position.
const POSITION_ICON_PATHS: Record<string, string> = {
  CARRY: 'M4 20 L16 8 M16 8 L13 8 M16 8 L16 11', // sword slash
  MID: 'M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z', // star
  OFF: 'M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z', // shield
  SOFT4: 'M12 3 C8 6 6 10 6 13 A6 6 0 0 0 18 13 C18 10 16 6 12 3 Z', // leaf
  HARD5: 'M2 12 C2 12 6 5 12 5 C18 5 22 12 22 12 C22 12 18 19 12 19 C6 19 2 12 2 12 Z M12 9 a3 3 0 1 0 0 6 a3 3 0 1 0 0 -6 Z', // eye/ward
};

export default function PositionIcon({ short, size = 11, color = 'rgba(255,255,255,0.65)' }: { short: string; size?: number; color?: string }) {
  const path = POSITION_ICON_PATHS[short];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
