import MatchMap from './MatchMap';
import PlaybackPlayerRow from './PlaybackPlayerRow';
import AdvantageGraph from './AdvantageGraph';
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

/**
 * Full-page, dedicated Match Playback view (its own tab, not the embedded
 * strip on Overview): an enlarged interactive map beside a live-updating
 * per-player scoreboard for both teams, transport controls, team totals,
 * and the gold/XP advantage graph — all sharing one clock, own to this
 * page (independent of Overview's own scrubber).
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
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 460px', maxWidth: '600px', minWidth: '340px' }}>
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

        <div style={{ flex: '2 1 560px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--radiant-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconRadiant style={{ width: 16, height: 16 }} /> Radiant
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {radiant.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} allPlayers={allPlayers} currentTime={currentTime} />)}
            </div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--dire-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconDire style={{ width: 16, height: 16 }} /> Dire
            </h4>
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
  );
}
