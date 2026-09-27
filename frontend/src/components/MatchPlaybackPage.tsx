import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import MatchMap from './MatchMap';
import PlaybackPlayerRow from './PlaybackPlayerRow';
import PlaybackAdvantageGraph from './PlaybackAdvantageGraph';
import FullBleed from './FullBleed';
import { interpAtTime, liveCount } from './LiveScoreboardPanel';
import { useMatchPlayback } from '../hooks/useMatchPlayback';
import { IconRadiant, IconDire } from './Icons';

function fmtClock(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function teamTotals(players: any[], currentTime: number) {
  return players.reduce((acc, p) => {
    acc.kills += liveCount(p, 'kills_log', currentTime);
    acc.deaths += liveCount(p, 'deaths_log', currentTime);
    acc.assists += p.assists || 0;
    acc.cs += Math.round(interpAtTime(p.lh_t, currentTime));
    acc.gold += interpAtTime(p.gold_t, currentTime);
    acc.xp += interpAtTime(p.xp_t, currentTime);
    acc.heal += Math.round(interpAtTime(p.hero_healing_t, currentTime));
    acc.dmg += Math.round(interpAtTime(p.hero_damage_t, currentTime));
    acc.netWorth += interpAtTime(p.networth_t, currentTime) || interpAtTime(p.gold_t, currentTime);
    return acc;
  }, { kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, xp: 0, heal: 0, dmg: 0, netWorth: 0 });
}

/** Kill-event ticker: every kill up to currentTime, small killer-hero icons
 * in chronological order — real data (kills_log per player), same source
 * AdvantageGraph's kill dots already use. */
function KillTicker({ allPlayers, currentTime }: { allPlayers: any[]; currentTime: number }) {
  const events: { time: number; heroId: number; isRadiant: boolean }[] = [];
  allPlayers.forEach((p: any) => {
    let log = p.kills_log;
    if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
    if (Array.isArray(log)) {
      log.forEach((e: any) => { if ((e.time ?? -1) <= currentTime) events.push({ time: e.time, heroId: p.hero_id, isRadiant: p.player_slot < 128 }); });
    }
  });
  events.sort((a, b) => a.time - b.time);
  if (events.length === 0) return null;
  return (
    <div className="glass-surface" style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
      {events.map((e, i) => {
        const hero = HEROES[e.heroId];
        return (
          <div key={i} title={`${hero?.name || 'Unknown'} kill @ ${fmtClock(e.time)}`} style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{fmtClock(e.time)}</div>
            <div style={{ border: `1px solid ${e.isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`, borderRadius: '2px', width: '26px', height: '15px' }}>
              {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamHeader({ label, color, Icon }: { label: string; color: string; Icon: any }) {
  return (
    <>
      <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon style={{ width: 18, height: 18 }} /> {label}
      </h4>
      <div style={{ display: 'flex', gap: '0.8rem', padding: '0 0.7rem', marginBottom: '0.35rem', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        <span style={{ width: '160px', flexShrink: 0 }}>Player / HP / MP</span>
        <span style={{ flex: 1, textAlign: 'center', minWidth: '140px' }}>K/D/A · CS · GPM/XPM · Heal/DMG/TD</span>
        <span style={{ flexShrink: 0, textAlign: 'right' }}>Items / Backpack / Gold</span>
      </div>
    </>
  );
}

/**
 * Full-page, dedicated Match Playback view (its own tab, not the embedded
 * strip on Overview): a large interactive map with real, disappearing
 * building markers spanning the full width, Radiant/Dire team scoreboards
 * below it (side by side, each headed with the team's emblem and explicit
 * column labels), transport controls, team totals, and — at the very
 * bottom — a dedicated advantage graph with a moving position indicator
 * and killed-hero portrait markers. Breaks out of the page's normal
 * max-width container to use the full available width (FullBleed).
 *
 * HP/Mana bars show a real max (real hero stats + level, see
 * lib/heroVitals.ts) but the fill only tracks alive/dead — no timestamped
 * combat-log data exists anywhere in this app to reconstruct real per-hit
 * damage over time, so this doesn't fabricate a moment-to-moment curve.
 */
export default function MatchPlaybackPage({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  const playback = useMatchPlayback(4, matchData?.duration || 0);
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);
  const duration = matchData?.duration || 0;
  const currentTime = playback.currentTime;

  if (!matchData?.is_parsed) {
    return (
      <div className="glass-surface" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
        Playback unlocks once the replay is fully parsed.
      </div>
    );
  }

  const radTotals = teamTotals(radiant, currentTime);
  const direTotals = teamTotals(dire, currentTime);
  const radLeads = radTotals.netWorth >= direTotals.netWorth;

  return (
    <FullBleed>
      <div className="animate-fade-in">
        <KillTicker allPlayers={allPlayers} currentTime={currentTime} />

        {/* Map on the left, both team stacks on the right, side by side —
            roughly equal width so the map is genuinely big, and wraps to
            stacked on narrower screens instead of squeezing either side. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', minWidth: '420px' }}>
            <MatchMap
              matchData={matchData}
              selectedPlayer={undefined}
              compact={false}
              controlledTime={playback.currentTime}
              controlledIsPlaying={playback.isPlaying}
              controlledSpeed={playback.playbackSpeed}
              onControlledTimeChange={playback.setCurrentTime}
              onControlledPlayingChange={playback.setIsPlaying}
              onControlledSpeedChange={playback.setPlaybackSpeed}
              hideControls
            />
          </div>

          <div style={{ flex: '1 1 480px', display: 'flex', flexWrap: 'wrap', gap: '1rem', minWidth: 0 }}>
            <div style={{ flex: '1 1 260px', minWidth: '260px' }}>
              <TeamHeader label="Radiant" color="var(--radiant-green)" Icon={IconRadiant} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {radiant.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} allPlayers={allPlayers} currentTime={currentTime} />)}
              </div>
            </div>
            <div style={{ flex: '1 1 260px', minWidth: '260px' }}>
              <TeamHeader label="Dire" color="var(--dire-red)" Icon={IconDire} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dire.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} allPlayers={allPlayers} currentTime={currentTime} />)}
              </div>
            </div>
          </div>
        </div>

        {/* Transport controls */}
        <div className="glass-surface" style={{ marginTop: '1.25rem', padding: '0.75rem 1rem' }}>
          <input
            type="range" min={0} max={duration} value={currentTime}
            onChange={(e) => playback.setCurrentTime(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button onClick={() => playback.setIsPlaying(!playback.isPlaying)} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>
              {playback.isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => playback.setCurrentTime(Math.max(0, currentTime - 30))} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>⏮</button>
            <button onClick={() => playback.setCurrentTime(Math.min(duration, currentTime + 30))} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>⏭</button>
            {[1, 2, 4, 8].map((s) => (
              <button key={s} onClick={() => playback.setPlaybackSpeed(s)} style={{
                background: playback.playbackSpeed === s ? 'var(--accent-gold)' : 'transparent',
                color: playback.playbackSpeed === s ? '#000' : 'var(--text-muted)',
                border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold',
              }}>{s}x</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fmtClock(currentTime)} / {fmtClock(duration)}</span>
          </div>
        </div>

        {/* Team totals */}
        <div className="glass-surface" style={{ marginTop: '1rem', padding: '0.75rem 1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                <th style={{ textAlign: 'left', padding: '0.3rem' }}>Team</th>
                <th>K</th><th>D</th><th>A</th><th>CS</th><th>GPM</th><th>XPM</th><th>Heal</th><th>DMG</th><th>Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {[{ label: 'Radiant', color: 'var(--radiant-green)', t: radTotals }, { label: 'Dire', color: 'var(--dire-red)', t: direTotals }].map((row) => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.4rem 0.3rem', color: row.color, fontWeight: 700 }}>{row.label}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.kills}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.deaths}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.assists}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.cs}</td>
                  <td style={{ textAlign: 'center' }}>{Math.round(row.t.gold / Math.max(1 / 60, currentTime / 60))}</td>
                  <td style={{ textAlign: 'center' }}>{Math.round(row.t.xp / Math.max(1 / 60, currentTime / 60))}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.heal.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>{row.t.dmg.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', color: row.label === (radLeads ? 'Radiant' : 'Dire') ? 'var(--accent-gold)' : 'inherit' }}>{Math.round(row.t.netWorth).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom graph: real gold/XP advantage, a moving position bar synced
            to the clock above, and kill markers showing the killed hero's
            portrait */}
        <div className="glass-surface" style={{ marginTop: '1rem', padding: '1rem' }}>
          <PlaybackAdvantageGraph matchData={matchData} allPlayers={allPlayers} currentTime={currentTime} height={280} />
        </div>
      </div>
    </FullBleed>
  );
}
