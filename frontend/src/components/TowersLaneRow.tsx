import { HEROES } from '../lib/heroes';
import { getHeroIcon } from '../lib/dota';
import { getStandingBuildings, buildingLabel } from '../lib/buildings';
import AdvantageGraph from './AdvantageGraph';

const LANE_NAMES: Record<number, string> = { 1: 'Bottom Lane', 2: 'Middle Lane', 3: 'Top Lane' };

/** Real map geometry (Stratz's own asset) with every standing tower,
 * barracks, and Ancient plotted at its true position — computed from the
 * match's `objectives` building_kill log (reliably populated) rather than
 * the OpenDota summary's tower_status bitmask (often missing for
 * locally-parsed matches). Destroyed buildings are simply omitted,
 * matching Stratz's sparse marker look. When `currentTime` is given (the
 * page's shared playback clock), only buildings destroyed by that point
 * count as gone — scrubbing back earlier in the match brings them back. */
export function MiniMap({ matchData, currentTime }: { matchData: any; currentTime?: number }) {
  const { radiant, dire } = getStandingBuildings(matchData, currentTime);

  const renderBuilding = (b: ReturnType<typeof getStandingBuildings>['radiant'][number], isRadiant: boolean) => {
    const isAncient = b.id[0] === 'a';
    return (
      <div
        key={b.id}
        title={`${buildingLabel(b.id)} — ${isRadiant ? 'Radiant' : 'Dire'} — Standing`}
        style={{
          position: 'absolute', top: `${b.topPct}%`, left: `${b.leftPct}%`, transform: 'translate(-50%,-50%)',
          width: isAncient ? '9px' : '7px', height: isAncient ? '9px' : '7px', borderRadius: '2px',
          background: '#ff8c1a',
          border: '1px solid rgba(0,0,0,0.6)',
        }}
      />
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#17181b' }}>
      <img
        src="/assets/images/dota2/minimap_geometry_current.png"
        alt="Map"
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'invert(0.85) hue-rotate(180deg) brightness(0.6) saturate(0.9)' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {radiant.map((b) => renderBuilding(b, true))}
      {dire.map((b) => renderBuilding(b, false))}
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

export default function TowersLaneRow({ matchData, allPlayers, currentTime }: { matchData: any; allPlayers: any[]; currentTime?: number }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch', marginTop: '1.5rem' }}>
      <div style={{ flex: '1 1 220px', maxWidth: '260px' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Towers</h4>
        <MiniMap matchData={matchData} currentTime={currentTime} />
      </div>
      <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 420px', minWidth: '340px' }}>
        <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={240} currentTime={currentTime} />
      </div>
      <LaneMatchupCards allPlayers={allPlayers} />
    </div>
  );
}
