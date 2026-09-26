import { HEROES } from '../lib/heroes';
import { getHeroIcon } from '../lib/dota';
import AdvantageGraph from './AdvantageGraph';

const LANE_NAMES: Record<number, string> = { 1: 'Bottom Lane', 2: 'Middle Lane', 3: 'Top Lane' };

/** Small static snapshot map: every ward placed over the whole match, as a
 * compact visual summary (matching Stratz's cluster-of-markers mini-map)
 * rather than an interactive/controllable view. */
function MiniMap({ allPlayers }: { allPlayers: any[] }) {
  const markers: { left: number; top: number; type: 'obs' | 'sen' }[] = [];
  const collect = (log: any, type: 'obs' | 'sen') => {
    let arr = log;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (Array.isArray(arr)) {
      arr.forEach((e: any) => {
        if (e?.x && e?.y) {
          markers.push({
            left: Math.min(100, Math.max(0, ((e.x - 64) / 128) * 100)),
            top: Math.min(100, Math.max(0, (1 - ((e.y - 64) / 128)) * 100)),
            type,
          });
        }
      });
    }
  };
  allPlayers.forEach((p) => { collect(p.obs_log, 'obs'); collect(p.sen_log, 'sen'); });

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#0a0a0a' }}>
      <img
        src="/assets/images/dota2/Game_map_7.41.jpg"
        alt="Map"
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {markers.map((m, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${m.left}%`, top: `${m.top}%`, transform: 'translate(-50%,-50%)',
          width: '6px', height: '6px', borderRadius: m.type === 'obs' ? '50%' : '1px',
          background: m.type === 'obs' ? '#3b82f6' : '#eab308',
          border: '1px solid rgba(0,0,0,0.7)',
        }} />
      ))}
    </div>
  );
}

function LaneMatchupCards({ allPlayers }: { allPlayers: any[] }) {
  const lanes = [3, 2, 1]; // Top, Mid, Bottom, matching the Stratz reference order

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
      {lanes.map((lane) => {
        const lanePlayers = allPlayers.filter((p) => p.lane === lane);
        const radiant = lanePlayers.filter((p) => p.player_slot < 128);
        const dire = lanePlayers.filter((p) => p.player_slot >= 128);
        let winner: 'radiant' | 'dire' | null = null;
        if (radiant.length && dire.length) {
          const radiantEff = radiant.reduce((s, p) => s + (p.lane_efficiency_pct || 0), 0);
          const direEff = dire.reduce((s, p) => s + (p.lane_efficiency_pct || 0), 0);
          if (radiantEff || direEff) winner = radiantEff >= direEff ? 'radiant' : 'dire';
        }

        const renderHeroes = (players: any[]) => players.length > 0 ? players.map((p) => {
          const hero = HEROES[p.hero_id];
          return hero && <img key={p.player_slot} src={getHeroIcon(hero.img_name)} alt={hero.name} title={hero.name} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border-color)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
        }) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>;

        return (
          <div key={lane} className="glass-surface" style={{ padding: '0.6rem 0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              {renderHeroes(radiant)}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0.4rem' }}>vs</span>
              {renderHeroes(dire)}
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.4rem', fontSize: '0.75rem' }}>
              {winner ? (
                <span style={{ color: winner === 'radiant' ? 'var(--radiant-green)' : 'var(--dire-red)', fontWeight: 700 }}>
                  {winner === 'radiant' ? 'Radiant' : 'Dire'} Won
                </span>
              ) : <span style={{ color: 'var(--text-muted)' }}>No data</span>}
              <span style={{ color: 'var(--text-muted)' }}> · {LANE_NAMES[lane]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TowersLaneRow({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch', marginTop: '1.5rem' }}>
      <div style={{ flex: '1 1 220px', maxWidth: '260px' }}>
        <MiniMap allPlayers={allPlayers} />
      </div>
      <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 420px', minWidth: '340px' }}>
        <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={240} />
      </div>
      <LaneMatchupCards allPlayers={allPlayers} />
    </div>
  );
}
