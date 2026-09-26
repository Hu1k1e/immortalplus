import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';

function DraftGrid({ matchData }: { matchData: any }) {
  let draft = matchData?.draft_timings;
  if (typeof draft === 'string') {
    try { draft = JSON.parse(draft); } catch { draft = []; }
  }
  if (!Array.isArray(draft) || draft.length === 0) {
    return (
      <div className="glass-surface" style={{ padding: '1rem', flex: 1 }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Draft</h4>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Draft data not available for this match.</div>
      </div>
    );
  }

  // OpenDota's real picks_bans shape: { is_pick, hero_id, team, order } —
  // team 0 = Radiant, 1 = Dire.
  const sorted = [...draft].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const radiantPicks = sorted.filter((d) => d.is_pick && d.team === 0);
  const direPicks = sorted.filter((d) => d.is_pick && d.team === 1);
  const radiantBans = sorted.filter((d) => !d.is_pick && d.team === 0);
  const direBans = sorted.filter((d) => !d.is_pick && d.team === 1);

  const renderHero = (d: any, dim = false) => {
    const hero = HEROES[d.hero_id];
    return (
      <img
        key={d.order}
        src={hero ? getHeroImage(hero.img_name) : ''}
        alt={hero?.name || '?'}
        title={hero?.name}
        style={{
          width: '38px', height: '21px', objectFit: 'cover', borderRadius: '3px',
          opacity: dim ? 0.45 : 1,
          filter: dim ? 'grayscale(60%)' : 'none',
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  const Column = ({ title, color, picks, bans }: { title: string; color: string; picks: any[]; bans: any[] }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color, marginBottom: '0.4rem' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.5rem' }}>
        {picks.map((d) => renderHero(d))}
      </div>
      {bans.length > 0 && (
        <>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>BANNED</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {bans.map((d) => renderHero(d, true))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: 1 }}>
      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Draft</h4>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Column title="Radiant" color="var(--radiant-green)" picks={radiantPicks} bans={radiantBans} />
        <div style={{ width: '1px', background: 'var(--border-color)' }} />
        <Column title="Dire" color="var(--dire-red)" picks={direPicks} bans={direBans} />
      </div>
    </div>
  );
}

function purchaseLogOf(p: any) {
  let log = p.purchase_log;
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { log = []; }
  }
  return Array.isArray(log) ? log.filter((e: any) => e.key && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser').slice(0, 8) : [];
}

function BuildRow({ player }: { player: any }) {
  const hero = HEROES[player.hero_id];
  const log = purchaseLogOf(player);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '32px', height: '18px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.persona || player.personaname || 'Anonymous'}
        </span>
      </div>
      {log.length === 0 ? (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '2.2rem' }}>No item timing data.</span>
      ) : (
        <div style={{ display: 'flex', gap: '4px', marginLeft: '2.2rem', overflowX: 'auto', paddingBottom: '2px' }}>
          {log.map((entry: any, i: number) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <img
                src={getItemImage(entry.key)}
                alt={entry.key}
                title={entry.key.replace(/_/g, ' ')}
                style={{ width: '24px', height: '17px', objectFit: 'cover', borderRadius: '3px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {Math.floor((entry.time || 0) / 60)}:{((entry.time || 0) % 60).toString().padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuildTimeline({ allPlayers }: { allPlayers: any[] }) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);
  const hasAny = allPlayers.some((p) => purchaseLogOf(p).length > 0);

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 560px', minWidth: '420px' }}>
      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>Builds</h4>
      {!hasAny ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Item timing data not available.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem 1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {radiant.map((p) => <BuildRow key={p.player_slot} player={p} />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {dire.map((p) => <BuildRow key={p.player_slot} player={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

const KILL_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'hero_kills', label: 'Hero', color: 'var(--dire-red)' },
  { key: 'tower_kills', label: 'Tower', color: 'var(--radiant-green)' },
  { key: 'roshan_kills', label: 'Roshan', color: '#ff9800' },
  { key: 'courier_kills', label: 'Courier', color: 'var(--accent-gold)' },
  { key: 'neutral_kills', label: 'Neutral', color: '#42a5f5' },
];

function KillBreakdownColumn({ title, color, players }: { title: string; color: string; players: any[] }) {
  return (
    <div style={{ flex: 1 }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color }}>{title}</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            <th style={{ textAlign: 'left', padding: '0.35rem 0.3rem', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Player</th>
            {KILL_CATEGORIES.map((c) => (
              <th key={c.key} style={{ textAlign: 'center', padding: '0.35rem 0.3rem', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const hero = HEROES[p.hero_id];
            return (
              <tr key={p.player_slot} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.4rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '28px', height: '16px', objectFit: 'cover', borderRadius: '2px' }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>{p.persona || p.personaname || 'Anonymous'}</span>
                </td>
                {KILL_CATEGORIES.map((c) => {
                  const val = p[c.key] || 0;
                  return (
                    <td key={c.key} style={{ textAlign: 'center', padding: '0.4rem 0.3rem', color: val > 0 ? c.color : 'var(--text-muted)', fontWeight: val > 0 ? 700 : 400 }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KillBreakdownTable({ allPlayers }: { allPlayers: any[] }) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: '1 1 100%', display: 'flex', gap: '1.5rem' }}>
      <KillBreakdownColumn title="Radiant - Kill Breakdown" color="var(--radiant-green)" players={radiant} />
      <div style={{ width: '1px', background: 'var(--border-color)' }} />
      <KillBreakdownColumn title="Dire - Kill Breakdown" color="var(--dire-red)" players={dire} />
    </div>
  );
}

export default function DraftBuildsKillsRow({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <DraftGrid matchData={matchData} />
        <BuildTimeline allPlayers={allPlayers} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <KillBreakdownTable allPlayers={allPlayers} />
      </div>
    </div>
  );
}
