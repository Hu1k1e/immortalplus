import { useState } from 'react';
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

function formatClock(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Which enemy heroes a player killed, when, and how many times — resolved
 * from kills_log's victim `key` (an npc name) against the hero table, same
 * matching pattern used elsewhere for kills_log (AdvantageGraph, story).
 * Per-kill gold/XP isn't shown on hover because no data source available
 * here records it per kill (kills_log only has {time, key}) — showing
 * real kill timestamps instead of a fabricated bounty estimate. */
function killsByVictimHero(player: any): Map<number, number[]> {
  let log = player.kills_log;
  if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
  const times = new Map<number, number[]>();
  if (!Array.isArray(log)) return times;
  log.forEach((e: any) => {
    const victim = Object.values(HEROES).find((h: any) => `npc_dota_hero_${h.img_name}` === e.key || h.img_name === e.key) as any;
    if (victim) {
      const list = times.get(victim.id) || [];
      list.push(e.time || 0);
      times.set(victim.id, list);
    }
  });
  return times;
}

function KillCell({ hero, kills }: { hero: any; kills: number[] }) {
  const [hovered, setHovered] = useState(false);
  const val = kills.length;
  return (
    <div
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: val > 0 ? 'default' : undefined,
        background: val > 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: val > 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        opacity: val > 0 ? 1 : 0.35,
      }}
      onMouseEnter={() => val > 0 && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px', filter: val > 0 ? 'none' : 'grayscale(100%)' }} />
      <span style={{ fontWeight: val > 0 ? 700 : 400, color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)', minWidth: '10px' }}>{val}</span>
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '4px', zIndex: 30,
          background: 'rgba(15,17,21,0.98)', border: '1px solid var(--border-color)', borderRadius: '4px',
          padding: '0.35rem 0.55rem', fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
        }}>
          {hero.name} killed at {kills.map(formatClock).join(', ')}
        </div>
      )}
    </div>
  );
}

function KillBreakdownColumn({ title, color, team, enemyTeam }: { title: string; color: string; team: any[]; enemyTeam: any[] }) {
  const enemyHeroes = enemyTeam.map((p) => ({ slot: p.player_slot, hero: HEROES[p.hero_id] })).filter((e) => e.hero);
  const columnTotals = enemyHeroes.map(() => 0);
  const rows = team.map((p) => {
    const times = killsByVictimHero(p);
    const perEnemy = enemyHeroes.map((e) => times.get(e.hero.id) || []);
    perEnemy.forEach((list, i) => { columnTotals[i] += list.length; });
    return { player: p, perEnemy, total: perEnemy.reduce((a, b) => a + b.length, 0) };
  });
  const grandTotal = columnTotals.reduce((a, b) => a + b, 0);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color }}>{title}</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <tbody>
          {rows.map(({ player: p, perEnemy, total }) => {
            const hero = HEROES[p.hero_id];
            return (
              <tr key={p.player_slot} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '0.4rem 0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '3px' }} />}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{p.persona || p.personaname || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{total} kills</div>
                    </div>
                  </div>
                </td>
                {enemyHeroes.map((e, i) => (
                  <td key={e.slot} style={{ textAlign: 'center', padding: '0.4rem 0.3rem' }}>
                    <KillCell hero={e.hero} kills={perEnemy[i]} />
                  </td>
                ))}
              </tr>
            );
          })}
          <tr>
            <td style={{ padding: '0.5rem 0.3rem', fontWeight: 700 }}>{grandTotal} kills</td>
            {enemyHeroes.map((e, i) => (
              <td key={e.slot} style={{ textAlign: 'center', padding: '0.5rem 0.3rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <img src={getHeroImage(e.hero.img_name)} alt={e.hero.name} style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '3px' }} />
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{columnTotals[i]}</span>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function KillBreakdownTable({ allPlayers }: { allPlayers: any[] }) {
  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);

  return (
    <div className="glass-surface" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Kill Breakdown</h3>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <KillBreakdownColumn title="Radiant" color="var(--radiant-green)" team={radiant} enemyTeam={dire} />
        <div style={{ width: '1px', background: 'var(--border-color)' }} />
        <KillBreakdownColumn title="Dire" color="var(--dire-red)" team={dire} enemyTeam={radiant} />
      </div>
    </div>
  );
}

export { KillBreakdownTable };

// Kill Breakdown lives after Builds on the Overview page now (MatchOverview
// renders it separately via the named export above), so this default
// export is just the Draft section.
export default function DraftBuildsKillsRow({ matchData }: { matchData: any }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <DraftGrid matchData={matchData} />
    </div>
  );
}
