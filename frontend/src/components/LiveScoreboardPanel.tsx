import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { TeamTable } from './MatchTabs';

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

interface LiveScoreboardPanelProps {
  allPlayers: any[];
  currentTime: number;
}

export default function LiveScoreboardPanel({ allPlayers, currentTime }: LiveScoreboardPanelProps) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  const columns = [
    { key: 'k', label: 'K', render: (p: any) => liveKillCount(p, currentTime) },
    { key: 'd', label: 'D', render: (p: any) => liveDeathCount(p, currentTime) },
    { key: 'cs', label: 'CS', render: (p: any) => Math.round(interpAtTime(p.lh_t, currentTime)) },
    {
      key: 'gpm', label: 'GPM', render: (p: any) => {
        const nw = interpAtTime(p.gold_t, currentTime);
        return Math.round(nw / Math.max(1, currentTime / 60));
      }
    },
    {
      key: 'xpm', label: 'XPM', render: (p: any) => {
        const xp = interpAtTime(p.xp_t, currentTime);
        return Math.round(xp / Math.max(1, currentTime / 60));
      }
    },
    {
      key: 'nw', label: 'NET', render: (p: any) => {
        const nw = interpAtTime(p.networth_t, currentTime);
        return nw >= 1000 ? `${(nw / 1000).toFixed(1)}k` : Math.round(nw);
      }
    },
    {
      key: 'items', label: 'ITEMS', render: (p: any) => {
        const items = liveItems(p, currentTime);
        if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        return (
          <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
            {items.map((key, i) => (
              <img key={i} src={getItemImage(key)} alt={key} title={key.replace(/_/g, ' ')}
                style={{ width: '18px', height: '14px', objectFit: 'cover', borderRadius: '2px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        );
      }
    },
  ];

  return (
    <div>
      <KillEventRibbon allPlayers={allPlayers} currentTime={currentTime} />
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
          <TeamTable title="Radiant" players={radiant} columns={columns} noOverflow />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
          <TeamTable title="Dire" players={dire} columns={columns} noOverflow />
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
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
