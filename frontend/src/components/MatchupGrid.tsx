import MatchupCard from './MatchupCard';

interface MatchupGridProps {
  allPlayers: any[];
  onSelectPlayer?: (player: any) => void;
}

export default function MatchupGrid({ allPlayers, onSelectPlayer }: MatchupGridProps) {
  if (!allPlayers || allPlayers.length < 10) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Matchup data not available.</div>;
  }

  const radiant = allPlayers.filter((p) => p.player_slot < 128).sort((a, b) => a.player_slot - b.player_slot);
  const dire = allPlayers.filter((p) => p.player_slot >= 128).sort((a, b) => a.player_slot - b.player_slot);

  return (
    <div>
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Matchup</h3>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px', overflowX: 'auto' }}>
        {radiant.map((p) => (
          <MatchupCard key={p.player_slot} player={p} allPlayers={allPlayers} onClick={() => onSelectPlayer?.(p)} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700 }}>
          vs
        </div>
        {dire.map((p) => (
          <MatchupCard key={p.player_slot} player={p} allPlayers={allPlayers} onClick={() => onSelectPlayer?.(p)} />
        ))}
      </div>
    </div>
  );
}
