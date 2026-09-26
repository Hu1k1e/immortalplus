import AdvantageGraph from './AdvantageGraph';

const TOTAL_TOWERS_PER_TEAM = 11;
const LANE_NAMES: Record<number, string> = { 1: 'Bottom', 2: 'Mid', 3: 'Top' };

function parseObjectives(matchData: any): any[] {
  let objectives = matchData?.objectives;
  if (typeof objectives === 'string') {
    try { objectives = JSON.parse(objectives); } catch { objectives = []; }
  }
  return Array.isArray(objectives) ? objectives : [];
}

function TowersStandingIndicator({ matchData }: { matchData: any }) {
  const objectives = parseObjectives(matchData);
  let radiantLost = 0;
  let direLost = 0;
  objectives.forEach((obj: any) => {
    if (obj.type === 'building_kill' || obj.type === 'CHAT_MESSAGE_TOWER_KILL') {
      const key = String(obj.key || '');
      const isRadiantTower = key.indexOf('goodguys') !== -1 || obj.team === 2;
      if (isRadiantTower) radiantLost += 1;
      else direLost += 1;
    }
  });

  const radiantUp = Math.max(0, TOTAL_TOWERS_PER_TEAM - radiantLost);
  const direUp = Math.max(0, TOTAL_TOWERS_PER_TEAM - direLost);

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: 1 }}>
      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Towers Standing</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--radiant-green)' }}>{radiantUp}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RADIANT / {TOTAL_TOWERS_PER_TEAM}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--dire-red)' }}>{direUp}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DIRE / {TOTAL_TOWERS_PER_TEAM}</div>
        </div>
      </div>
    </div>
  );
}

function LaneWonPanel({ allPlayers }: { allPlayers: any[] }) {
  const lanes = [1, 2, 3];
  const results = lanes.map((lane) => {
    const lanePlayers = allPlayers.filter((p) => p.lane === lane);
    if (lanePlayers.length < 2) return { lane, winner: null as 'radiant' | 'dire' | null };
    const radiantEff = lanePlayers.filter((p) => p.player_slot < 128).reduce((sum, p) => sum + (p.lane_efficiency_pct || 0), 0);
    const direEff = lanePlayers.filter((p) => p.player_slot >= 128).reduce((sum, p) => sum + (p.lane_efficiency_pct || 0), 0);
    if (radiantEff === 0 && direEff === 0) return { lane, winner: null as 'radiant' | 'dire' | null };
    return { lane, winner: (radiantEff >= direEff ? 'radiant' : 'dire') as 'radiant' | 'dire' };
  });

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: 1 }}>
      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Lane Won</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {results.map(({ lane, winner }) => (
          <div key={lane} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{LANE_NAMES[lane]}</span>
            {winner ? (
              <span style={{
                padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700,
                color: '#000', background: winner === 'radiant' ? 'var(--radiant-green)' : 'var(--dire-red)',
              }}>
                {winner === 'radiant' ? 'Radiant' : 'Dire'}
              </span>
            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TowersLaneRow({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch', marginTop: '1.5rem' }}>
      <TowersStandingIndicator matchData={matchData} />
      <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 400px', minWidth: '320px' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Net Worth / XP Advantage</h4>
        <AdvantageGraph matchData={matchData} height={220} />
      </div>
      <LaneWonPanel allPlayers={allPlayers} />
    </div>
  );
}
