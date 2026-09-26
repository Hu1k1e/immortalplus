import MatchupCard from './MatchupCard';

interface MatchupGridProps {
  allPlayers: any[];
  onSelectPlayer?: (player: any) => void;
}

/**
 * Pairs radiant vs dire players into lane matchups. lane_role (1 Safe, 2
 * Mid, 3 Off, 4 Jungle) is normalized to mean the same conceptual lane for
 * both teams (see backend replay_compute.py's per-team lane_role mapping),
 * so matching lane_role across teams gives the actual same-lane opponent.
 * Players missing lane_role (unparsed/incomplete data) fall back to
 * pairing by remaining order.
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

  // Fill any unmatched radiant slots with leftover dire players in order
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

  const pairs = pairMatchups(allPlayers);

  const netWorthOf = (p: any) => p?.net_worth ?? p?.networth ?? 0;
  const deltas = pairs.map(({ radiant, dire }) => netWorthOf(radiant) - netWorthOf(dire));
  const maxDelta = Math.max(1, ...deltas.map((d) => Math.abs(d)));

  return (
    <div>
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Matchup</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {pairs.map(({ radiant, dire }, i) => {
          const delta = netWorthOf(radiant) - netWorthOf(dire);
          return (
            <div key={radiant.player_slot} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <MatchupCard player={radiant} allPlayers={allPlayers} netWorthDelta={delta} maxDelta={maxDelta} onClick={() => onSelectPlayer?.(radiant)} />
              {dire ? (
                <MatchupCard player={dire} allPlayers={allPlayers} netWorthDelta={-delta} maxDelta={maxDelta} onClick={() => onSelectPlayer?.(dire)} />
              ) : <div key={`empty-${i}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
