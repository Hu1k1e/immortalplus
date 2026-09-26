import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';

// Interpolates a per-minute cumulative array (gold_t/xp_t/lh_t/networth_t/
// hero_damage_t/hero_healing_t style) at an arbitrary time in seconds, same
// lerp approach as MatchMap's hero-position interpolation.
function interpAtTime(arr: any, t: number): number {
  let series = arr;
  if (typeof series === 'string') {
    try { series = JSON.parse(series); } catch { return 0; }
  }
  if (!Array.isArray(series) || series.length === 0) return 0;
  const minute = t / 60;
  const i0 = Math.max(0, Math.min(series.length - 1, Math.floor(minute)));
  const i1 = Math.min(series.length - 1, i0 + 1);
  const frac = minute - i0;
  const v0 = series[i0] ?? 0;
  const v1 = series[i1] ?? v0;
  return v0 + (v1 - v0) * frac;
}

function liveCount(player: any, key: string, currentTime: number): number {
  let log = player[key];
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { return 0; }
  }
  if (!Array.isArray(log)) return 0;
  return log.filter((e: any) => (e.time ?? 0) <= currentTime).length;
}

function liveItems(player: any, currentTime: number): string[] {
  let log = player.purchase_log;
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { return []; }
  }
  if (!Array.isArray(log)) return [];
  return log
    .filter((e: any) => e.key && (e.time ?? 0) <= currentTime && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser')
    .slice(-6)
    .map((e: any) => e.key);
}

const GRID_COLS = '2.4fr 0.5fr 0.5fr 0.5fr 0.7fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 2.2fr';
const STAT_HEADERS = ['K', 'D', 'A', 'CS', 'GPM', 'XPM', 'HEAL', 'DMG', 'TD'];

function TeamPanel({ players, currentTime, isRadiant }: { players: any[]; currentTime: number; isRadiant: boolean }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
        {isRadiant ? 'Radiant' : 'Dire'}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.4rem', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 0.3rem 0.3rem' }}>
        <span>Player</span>
        {STAT_HEADERS.map((h) => <span key={h} style={{ textAlign: 'center' }}>{h}</span>)}
        <span>Items</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {players.map((p) => {
          const hero = HEROES[p.hero_id];
          const gold = interpAtTime(p.gold_t, currentTime);
          const xp = interpAtTime(p.xp_t, currentTime);
          const heal = Math.round(interpAtTime(p.hero_healing_t, currentTime));
          const dmg = Math.round(interpAtTime(p.hero_damage_t, currentTime));
          const td = Math.round(interpAtTime(p.tower_damage_t, currentTime));
          const cs = Math.round(interpAtTime(p.lh_t, currentTime));
          const minutesElapsed = Math.max(1 / 60, currentTime / 60);
          const gpm = Math.round(gold / minutesElapsed);
          const xpm = Math.round(xp / minutesElapsed);
          const kills = liveCount(p, 'kills_log', currentTime);
          const deaths = liveCount(p, 'deaths_log', currentTime);
          const items = liveItems(p, currentTime);

          return (
            <div key={p.player_slot} style={{
              display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.4rem', alignItems: 'center',
              padding: '0.5rem 0.3rem', borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '54px', height: '30px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.persona || p.personaname || 'Anonymous'}
                </span>
              </div>
              <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--radiant-green)', fontWeight: 600 }}>{kills}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--dire-red)', fontWeight: 600 }}>{deaths}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.assists ?? '-'}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem' }}>{cs}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem' }}>{gpm}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem' }}>{xpm}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--radiant-green)' }}>{heal || '-'}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem' }}>{dmg || '-'}</span>
              <span style={{ textAlign: 'center', fontSize: '0.8rem' }}>{td || '-'}</span>
              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                {items.length > 0 ? items.map((key, i) => (
                  <img key={i} src={getItemImage(key)} alt={key} title={key.replace(/_/g, ' ')}
                    style={{ width: '24px', height: '18px', objectFit: 'cover', borderRadius: '2px' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LiveScoreboardPanelProps {
  allPlayers: any[];
  currentTime: number;
}

export default function LiveScoreboardPanel({ allPlayers, currentTime }: LiveScoreboardPanelProps) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  return (
    <div>
      <KillEventRibbon allPlayers={allPlayers} currentTime={currentTime} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <TeamPanel players={radiant} currentTime={currentTime} isRadiant />
        <TeamPanel players={dire} currentTime={currentTime} isRadiant={false} />
      </div>
    </div>
  );
}

function KillEventRibbon({ allPlayers, currentTime }: { allPlayers: any[]; currentTime: number }) {
  const events: { time: number; heroId: number; isRadiant: boolean }[] = [];
  allPlayers.forEach((p) => {
    let log = p.kills_log;
    if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
    if (Array.isArray(log)) {
      log.forEach((e: any) => {
        if ((e.time ?? -1) <= currentTime) events.push({ time: e.time, heroId: p.hero_id, isRadiant: p.player_slot < 128 });
      });
    }
  });
  events.sort((a, b) => a.time - b.time);
  const recent = events.slice(-24);

  if (recent.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0.4rem 0', marginBottom: '0.8rem', borderBottom: '1px solid var(--border-color)' }}>
      {recent.map((e, i) => {
        const hero = HEROES[e.heroId];
        return (
          <div key={i} title={`${hero?.name || 'Unknown'} kill @ ${Math.floor(e.time / 60)}:${(e.time % 60).toString().padStart(2, '0')}`}
            style={{ flexShrink: 0, border: `1px solid ${e.isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`, borderRadius: '2px' }}>
            {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '22px', height: '13px', objectFit: 'cover', display: 'block' }} />}
          </div>
        );
      })}
    </div>
  );
}
