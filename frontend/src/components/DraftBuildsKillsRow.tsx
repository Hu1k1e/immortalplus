import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

function DraftGrid({ matchData }: { matchData: any }) {
  let draft = matchData?.draft_timings;
  if (typeof draft === 'string') {
    try { draft = JSON.parse(draft); } catch { draft = []; }
  }
  if (!Array.isArray(draft) || draft.length === 0) {
    return (
      <div className="glass-surface" style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Draft</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Draft data not available for this match — try "Sync Data" to re-fetch it, some older syncs predate draft support.
        </div>
      </div>
    );
  }

  // OpenDota's real picks_bans shape: { is_pick, hero_id, team, order } —
  // team 0 = Radiant, 1 = Dire.
  const sorted = [...draft].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const bans = sorted.filter((d) => !d.is_pick);
  const picks = sorted.filter((d) => d.is_pick);

  // Picks are grouped into phase-like chunks of 2 (one per team) purely for
  // display density — the real phase boundaries differ per draft mode
  // (Captain's Mode vs All Pick's ban phase) and aren't recorded in our
  // data, so this isn't a claim about the actual draft-mode phase timing.
  const phases: any[][] = [];
  for (let i = 0; i < picks.length; i += 2) phases.push(picks.slice(i, i + 2));

  const heroChip = (d: any, dim = false) => {
    const hero = HEROES[d.hero_id];
    return (
      <img
        key={d.order}
        src={hero ? getHeroImage(hero.img_name) : ''}
        alt={hero?.name || '?'}
        title={hero?.name}
        style={{
          width: '42px', height: '24px', objectFit: 'cover', borderRadius: '3px',
          opacity: dim ? 0.4 : 1,
          filter: dim ? 'grayscale(80%)' : 'none',
          border: `1px solid ${d.team === 0 ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  return (
    <div className="glass-surface" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Draft</h3>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {bans.length > 0 && (
          <div style={{ flex: '2 1 340px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Auto Bans</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {bans.map((d) => heroChip(d, true))}
            </div>
          </div>
        )}
        {phases.map((phase, i) => (
          <div key={i} style={{ flex: '1 1 110px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Pick phase {i + 1}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {phase.map((d) => heroChip(d, false))}
            </div>
          </div>
        ))}
      </div>
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
    <div className="glass-surface" style={{ padding: '1rem', display: 'flex', gap: '1.5rem' }}>
      <KillBreakdownColumn title="Radiant - Kill Breakdown" color="var(--radiant-green)" players={radiant} />
      <div style={{ width: '1px', background: 'var(--border-color)' }} />
      <KillBreakdownColumn title="Dire - Kill Breakdown" color="var(--dire-red)" players={dire} />
    </div>
  );
}

export default function DraftBuildsKillsRow({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <DraftGrid matchData={matchData} />
      <KillBreakdownTable allPlayers={allPlayers} />
    </div>
  );
}
