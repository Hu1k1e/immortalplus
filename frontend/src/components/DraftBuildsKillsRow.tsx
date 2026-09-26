import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { TeamTable, PercentBar } from './MatchTabs';

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

  // OpenDota draft_timings shape: { order, pick, active_team, hero_id, player_slot }.
  // active_team: 2 = Radiant, 3 = Dire (per OpenDota convention).
  const picks = draft.filter((d: any) => d.pick).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const bans = draft.filter((d: any) => !d.pick).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const renderHero = (d: any, i: number, dim = false) => {
    const hero = HEROES[d.hero_id];
    const isRadiant = d.active_team === 2;
    return (
      <img
        key={i}
        src={hero ? getHeroImage(hero.img_name) : ''}
        alt={hero?.name || '?'}
        title={hero?.name}
        style={{
          width: '30px', height: '17px', objectFit: 'cover', borderRadius: '2px',
          border: `1px solid ${isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
          opacity: dim ? 0.5 : 1,
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: 1 }}>
      <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.9rem' }}>Draft</h4>
      <div style={{ marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>PICKS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{picks.map((d: any, i: number) => renderHero(d, i))}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>BANS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{bans.map((d: any, i: number) => renderHero(d, i, true))}</div>
      </div>
    </div>
  );
}

function BuildTimeline({ allPlayers }: { allPlayers: any[] }) {
  const rows = allPlayers.map((p) => {
    let log = p.purchase_log;
    if (typeof log === 'string') {
      try { log = JSON.parse(log); } catch { log = []; }
    }
    log = Array.isArray(log) ? log.filter((e: any) => e.key && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser').slice(0, 8) : [];
    return { player: p, log };
  });

  const hasAny = rows.some((r) => r.log.length > 0);

  return (
    <div className="glass-surface" style={{ padding: '1rem', flex: '2 1 400px', minWidth: '320px' }}>
      <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.9rem' }}>Builds</h4>
      {!hasAny ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Item timing data not available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '260px', overflowY: 'auto' }}>
          {rows.map(({ player, log }) => {
            const hero = HEROES[player.hero_id];
            return (
              <div key={player.player_slot} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '28px', height: '16px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />}
                <div style={{ display: 'flex', gap: '2px', overflowX: 'auto' }}>
                  {log.map((entry: any, i: number) => (
                    <img
                      key={i}
                      src={getItemImage(entry.key)}
                      alt={entry.key}
                      title={`${entry.key.replace(/_/g, ' ')} @ ${Math.floor((entry.time || 0) / 60)}:${((entry.time || 0) % 60).toString().padStart(2, '0')}`}
                      style={{ width: '20px', height: '15px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KillBreakdownTable({ allPlayers }: { allPlayers: any[] }) {
  const maxVals = {
    hero: Math.max(1, ...allPlayers.map((p) => p.hero_kills || 0)),
    tower: Math.max(1, ...allPlayers.map((p) => p.tower_kills || 0)),
    roshan: Math.max(1, ...allPlayers.map((p) => p.roshan_kills || 0)),
    courier: Math.max(1, ...allPlayers.map((p) => p.courier_kills || 0)),
    neutral: Math.max(1, ...allPlayers.map((p) => p.neutral_kills || 0)),
  };

  const columns = [
    { key: 'hero', label: 'HERO', sortFn: (a: any, b: any) => (a.hero_kills || 0) - (b.hero_kills || 0), render: (p: any) => <PercentBar value={p.hero_kills || 0} max={maxVals.hero} color="var(--dire-red)" /> },
    { key: 'tower', label: 'TOWER', sortFn: (a: any, b: any) => (a.tower_kills || 0) - (b.tower_kills || 0), render: (p: any) => <PercentBar value={p.tower_kills || 0} max={maxVals.tower} color="var(--radiant-green)" /> },
    { key: 'roshan', label: 'ROSHAN', sortFn: (a: any, b: any) => (a.roshan_kills || 0) - (b.roshan_kills || 0), render: (p: any) => <PercentBar value={p.roshan_kills || 0} max={maxVals.roshan} color="#ff9800" /> },
    { key: 'courier', label: 'COURIER', sortFn: (a: any, b: any) => (a.courier_kills || 0) - (b.courier_kills || 0), render: (p: any) => <PercentBar value={p.courier_kills || 0} max={maxVals.courier} color="var(--accent-gold)" /> },
    { key: 'neutral', label: 'NEUTRAL', sortFn: (a: any, b: any) => (a.neutral_kills || 0) - (b.neutral_kills || 0), render: (p: any) => <PercentBar value={p.neutral_kills || 0} max={maxVals.neutral} color="#42a5f5" /> },
  ];

  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  return (
    <div style={{ flex: '1 1 100%' }}>
      <TeamTable title="Radiant - Kill Breakdown" players={radiant} columns={columns} noOverflow />
      <TeamTable title="Dire - Kill Breakdown" players={dire} columns={columns} noOverflow />
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
