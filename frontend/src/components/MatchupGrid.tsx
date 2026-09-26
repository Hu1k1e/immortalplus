import MatchupCard from './MatchupCard';

interface MatchupGridProps {
  allPlayers: any[];
  onSelectPlayer?: (player: any) => void;
}

/**
 * Pairs radiant vs dire players into lane matchups purely to compute each
 * player's net-worth delta against their same-lane opponent. lane_role (1
 * Safe, 2 Mid, 3 Off, 4 Jungle) is normalized to mean the same conceptual
 * lane for both teams (see backend replay_compute.py's per-team lane_role
 * mapping), so matching lane_role across teams gives the actual same-lane
 * opponent. Players missing lane_role (unparsed/incomplete data) fall back
 * to pairing by remaining order. Display order is by team slot (Stratz's
 * own layout), not by lane pairing.
 */
function pairMatchups(allPlayers: any[]) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  const direByRole = new Map<number, any>();
  const direLeftover: any[] = [];
  dire.forEach((p) => {
    if (p.lane_role != null && !direByRole.has(p.lane_role)) direByRole.set(p.lane_role, p);
    else direLeftover.push(p);
  });

  const pairs: { radiant: any; dire: any | null }[] = [];
  const usedDire = new Set<any>();

  radiant.forEach((rp) => {
    let match: any = null;
    if (rp.lane_role != null && direByRole.has(rp.lane_role) && !usedDire.has(direByRole.get(rp.lane_role))) {
      match = direByRole.get(rp.lane_role);
    }
    pairs.push({ radiant: rp, dire: match });
    if (match) usedDire.add(match);
  });

  const remainingDire = dire.filter((p) => !usedDire.has(p));
  let leftoverIdx = 0;
  pairs.forEach((pair) => {
    if (!pair.dire && leftoverIdx < remainingDire.length) {
      pair.dire = remainingDire[leftoverIdx++];
    }
  });

  return pairs;
}

export default function MatchupGrid({ allPlayers, onSelectPlayer }: MatchupGridProps) {
  if (!allPlayers || allPlayers.length < 10) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Matchup data not available.</div>;
  }

  const netWorthOf = (p: any) => p?.net_worth ?? p?.networth ?? 0;
  const pairs = pairMatchups(allPlayers);

  const deltaBySlot = new Map<number, number>();
  pairs.forEach(({ radiant, dire }) => {
    const delta = netWorthOf(radiant) - netWorthOf(dire);
    deltaBySlot.set(radiant.player_slot, delta);
    if (dire) deltaBySlot.set(dire.player_slot, -delta);
  });
  const maxDelta = Math.max(1, ...Array.from(deltaBySlot.values()).map((d) => Math.abs(d)));

  const radiant = allPlayers.filter((p) => p.player_slot < 128).sort((a, b) => a.player_slot - b.player_slot);
  const dire = allPlayers.filter((p) => p.player_slot >= 128).sort((a, b) => a.player_slot - b.player_slot);

  return (
    <div>
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Matchup</h3>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px', overflowX: 'auto' }}>
        {radiant.map((p) => (
          <MatchupCard
            key={p.player_slot}
            player={p}
            allPlayers={allPlayers}
            netWorthDelta={deltaBySlot.get(p.player_slot) || 0}
            maxDelta={maxDelta}
            onClick={() => onSelectPlayer?.(p)}
          />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700 }}>
          vs
        </div>
        {dire.map((p) => (
          <MatchupCard
            key={p.player_slot}
            player={p}
            allPlayers={allPlayers}
            netWorthDelta={deltaBySlot.get(p.player_slot) || 0}
            maxDelta={maxDelta}
            onClick={() => onSelectPlayer?.(p)}
          />
        ))}
      </div>
    </div>
  );
}
