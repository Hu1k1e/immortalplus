import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import MatchMap from './MatchMap';
import PlaybackPlayerRow, { ROW_GRID } from './PlaybackPlayerRow';
import AdvantageGraph from './AdvantageGraph';
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

const HEADER_GRID = ROW_GRID;

function TeamHeader({ label, color, Icon }: { label: string; color: string; Icon: any }) {
  return (
    <>
      <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon style={{ width: 16, height: 16 }} /> {label}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: HEADER_GRID, gap: '0.6rem', padding: '0 0.7rem', marginBottom: '0.35rem', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        <span>Player</span>
        <span style={{ textAlign: 'center' }}>K / D / A</span>
        <span style={{ textAlign: 'center' }}>CS</span>
        <span style={{ textAlign: 'center' }}>GPM / XPM</span>
        <span style={{ textAlign: 'center' }}>Heal / DMG / TD</span>
        <span style={{ textAlign: 'right' }}>Items / Time Dead</span>
      </div>
    </>
  );
}

/**
 * Full-page, dedicated Match Playback view (its own tab, not the embedded
 * strip on Overview): an enlarged interactive map (with real, disappearing
 * building markers) beside two side-by-side live-updating team scoreboards,
 * transport controls, team totals, and the gold/XP advantage graph — all
 * sharing one clock, own to this page (independent of Overview's own
 * scrubber). Breaks out of the page's normal max-width container to use
 * the full available width (FullBleed).
 *
 * HP/Mana bars are shown as labeled, honestly-empty slots — real
 * continuous HP/Mana reconstruction is a separate, not-yet-built backend
 * effort (see PlaybackPlayerRow's VitalBarPlaceholder), not something this
 * page fabricates numbers for.
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

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', width: '42%', minWidth: '420px', maxWidth: '900px' }}>
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

          <div style={{ flex: 1, display: 'flex', gap: '1rem', minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TeamHeader label="Radiant" color="var(--radiant-green)" Icon={IconRadiant} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {radiant.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} allPlayers={allPlayers} currentTime={currentTime} />)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TeamHeader label="Dire" color="var(--dire-red)" Icon={IconDire} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
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

        <div className="glass-surface" style={{ marginTop: '1rem', padding: '1rem' }}>
          <AdvantageGraph matchData={matchData} allPlayers={allPlayers} height={280} currentTime={currentTime} />
        </div>
      </div>
    </FullBleed>
  );
}
