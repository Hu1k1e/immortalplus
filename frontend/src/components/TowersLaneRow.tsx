import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import AdvantageGraph from './AdvantageGraph';

const LANE_NAMES: Record<number, string> = { 1: 'Bottom Lane', 2: 'Middle Lane', 3: 'Top Lane' };

// Same simplified tower layout MatchMap.tsx uses, so the mini-map here is
// visually consistent with the full playback map.
const RADIANT_TOWERS = [
  { x: 18, y: 82, label: 'Bot T1' }, { x: 38, y: 62, label: 'Mid T1' }, { x: 12, y: 52, label: 'Top T1' },
];
const DIRE_TOWERS = [
  { x: 88, y: 18, label: 'Top T1' }, { x: 62, y: 38, label: 'Mid T1' }, { x: 88, y: 48, label: 'Bot T1' },
];

function parseObjectives(matchData: any): any[] {
  let objectives = matchData?.objectives;
  if (typeof objectives === 'string') {
    try { objectives = JSON.parse(objectives); } catch { objectives = []; }
  }
  return Array.isArray(objectives) ? objectives : [];
}

function MiniMap({ matchData }: { matchData: any }) {
  const objectives = parseObjectives(matchData);
  const destroyedKeys = new Set<string>();
  objectives.forEach((obj: any) => {
    if (obj.type === 'building_kill' || obj.type === 'CHAT_MESSAGE_TOWER_KILL') {
      destroyedKeys.add(String(obj.key || ''));
    }
  });
  // Best-effort: we only know a tower lane/tier/side was destroyed, not
  // exactly which of the simplified markers below it maps to at this
  // resolution — dim tier-1 markers for a side once any tower on that
  // side's corresponding lane has fallen, rather than claiming precision
  // we don't have.
  const laneDestroyed = (isGoodguys: boolean, laneWord: string) =>
    [...destroyedKeys].some((k) => k.includes(isGoodguys ? 'goodguys' : 'badguys') && k.includes(laneWord));

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#0a0a0a' }}>
      <img
        src="/assets/images/dota2/Game_map_7.41.jpg"
        alt="Map"
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {RADIANT_TOWERS.map((t, i) => {
        const laneWord = t.label.includes('Bot') ? 'bot' : t.label.includes('Mid') ? 'mid' : 'top';
        const down = laneDestroyed(true, laneWord);
        return (
          <div key={`r${i}`} title={t.label} style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: '7px', height: '7px', background: down ? 'rgba(120,120,120,0.6)' : 'var(--radiant-green)', border: '1px solid #000', borderRadius: '1px', transform: 'translate(-50%,-50%)' }} />
        );
      })}
      {DIRE_TOWERS.map((t, i) => {
        const laneWord = t.label.includes('Bot') ? 'bot' : t.label.includes('Mid') ? 'mid' : 'top';
        const down = laneDestroyed(false, laneWord);
        return (
          <div key={`d${i}`} title={t.label} style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: '7px', height: '7px', background: down ? 'rgba(120,120,120,0.6)' : 'var(--dire-red)', border: '1px solid #000', borderRadius: '1px', transform: 'translate(-50%,-50%)' }} />
        );
      })}
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

        return (
          <div key={lane} className="glass-surface" style={{ padding: '0.6rem 0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              {radiant.length > 0 ? radiant.map((p) => {
                const hero = HEROES[p.hero_id];
                return hero && <img key={p.player_slot} src={getHeroImage(hero.img_name)} alt={hero.name} title={hero.name} style={{ width: '26px', height: '15px', objectFit: 'cover', borderRadius: '2px' }} />;
              }) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0.4rem' }}>vs</span>
              {dire.length > 0 ? dire.map((p) => {
                const hero = HEROES[p.hero_id];
                return hero && <img key={p.player_slot} src={getHeroImage(hero.img_name)} alt={hero.name} title={hero.name} style={{ width: '26px', height: '15px', objectFit: 'cover', borderRadius: '2px' }} />;
              }) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>}
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
        <MiniMap matchData={matchData} />
      </div>
      <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 420px', minWidth: '340px' }}>
        <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={240} />
      </div>
      <LaneMatchupCards allPlayers={allPlayers} />
    </div>
  );
}
