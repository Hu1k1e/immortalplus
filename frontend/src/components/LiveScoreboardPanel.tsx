import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';

// Interpolates a per-minute cumulative array (gold_t/xp_t/lh_t/networth_t
// style) at an arbitrary time in seconds, same lerp approach as MatchMap's
// hero-position interpolation.
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

function liveKillCount(player: any, currentTime: number): number {
  let log = player.kills_log;
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { return 0; }
  }
  if (!Array.isArray(log)) return 0;
  return log.filter((e: any) => (e.time ?? 0) <= currentTime).length;
}

function liveDeathCount(player: any, currentTime: number): number {
  let log = player.deaths_log;
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

const STAT_COLS = [
  { key: 'k', label: 'K' },
  { key: 'd', label: 'D' },
  { key: 'cs', label: 'CS' },
  { key: 'gpm', label: 'GPM' },
  { key: 'xpm', label: 'XPM' },
  { key: 'net', label: 'NET' },
];

function PlayerRow({ player, currentTime, isRadiant }: { player: any; currentTime: number; isRadiant: boolean }) {
  const hero = HEROES[player.hero_id];
  const gold = interpAtTime(player.gold_t, currentTime);
  const xp = interpAtTime(player.xp_t, currentTime);
  const netWorth = interpAtTime(player.networth_t, currentTime);
  const cs = interpAtTime(player.lh_t, currentTime);
  const minutesElapsed = Math.max(1 / 60, currentTime / 60);
  const stats: Record<string, string | number> = {
    k: liveKillCount(player, currentTime),
    d: liveDeathCount(player, currentTime),
    cs: Math.round(cs),
    gpm: Math.round(gold / minutesElapsed),
    xpm: Math.round(xp / minutesElapsed),
    net: netWorth >= 1000 ? `${(netWorth / 1000).toFixed(1)}k` : Math.round(netWorth),
  };
  const items = liveItems(player, currentTime);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.5rem', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`, background: 'rgba(255,255,255,0.02)' }}>
      {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} title={player.persona || hero.name} style={{ width: '48px', height: '27px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />}
      <div style={{ minWidth: '90px', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.7rem', flexShrink: 0 }}>
        {STAT_COLS.map((c) => (
          <div key={c.key} style={{ textAlign: 'center', minWidth: '28px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{c.label}</div>
            <div style={{ fontSize: '0.78rem', color: c.key === 'net' ? 'var(--accent-gold)' : 'var(--text-primary)', fontWeight: 600 }}>{stats[c.key]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto', flexShrink: 0 }}>
        {items.length > 0 ? items.map((key, i) => (
          <img key={i} src={getItemImage(key)} alt={key} title={key.replace(/_/g, ' ')}
            style={{ width: '22px', height: '16px', objectFit: 'cover', borderRadius: '2px' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )) : <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>}
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
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: '300px' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--radiant-green)' }}>Radiant</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {radiant.map((p) => <PlayerRow key={p.player_slot} player={p} currentTime={currentTime} isRadiant />)}
          </div>
        </div>
        <div style={{ flex: '1 1 320px', minWidth: '300px' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', color: 'var(--dire-red)' }}>Dire</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {dire.map((p) => <PlayerRow key={p.player_slot} player={p} currentTime={currentTime} isRadiant={false} />)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        GPM/XPM/CS/Net Worth are interpolated from per-minute data — HP/mana are not available yet (see roadmap).
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
    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0.4rem 0', marginBottom: '0.6rem', borderBottom: '1px solid var(--border-color)' }}>
      {recent.map((e, i) => {
        const hero = HEROES[e.heroId];
        return (
          <div key={i} title={`${hero?.name || 'Unknown'} kill @ ${Math.floor(e.time / 60)}:${(e.time % 60).toString().padStart(2, '0')}`}
            style={{ flexShrink: 0, border: `1px solid ${e.isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`, borderRadius: '2px' }}>
            {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '20px', height: '12px', objectFit: 'cover', display: 'block' }} />}
          </div>
        );
      })}
    </div>
  );
}
