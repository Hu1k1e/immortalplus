import { useEffect, useRef, useState } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import { getHeroVitals } from '../lib/heroVitals';
import { levelFromXp } from '../lib/heroLevel';
import MatchMap from './MatchMap';
import PlaybackPlayerRow, { getDeadStatus, getRealVitals } from './PlaybackPlayerRow';
import PlaybackAdvantageGraph from './PlaybackAdvantageGraph';
import FullBleed from './FullBleed';
import { interpAtTime, liveCount } from './LiveScoreboardPanel';
import { useMatchPlayback } from '../hooks/useMatchPlayback';
import { IconRadiant, IconDire } from './Icons';
import api from '../lib/api';

/**
 * Triggers the on-demand HP/Mana reconstruction (backend/services/
 * vitals_parser.py) the first time this page is opened for a match that
 * doesn't have it yet, then polls for it to land — mirroring the same
 * request+poll pattern MatchDetail.tsx already uses for the main replay
 * parse. Returns the real vitals-augmented players once available,
 * otherwise the original list unchanged (PlaybackPlayerRow falls back to
 * its own max-only placeholder in that case).
 */
function useVitalsData(matchId: number | undefined, isParsed: boolean, allPlayers: any[]) {
  const [players, setPlayers] = useState(allPlayers);
  const triedRef = useRef(false);

  useEffect(() => { setPlayers(allPlayers); triedRef.current = false; }, [matchId]);

  useEffect(() => {
    if (!matchId || !isParsed || triedRef.current) return;
    if (allPlayers.some((p) => p.vitals_t)) return;
    triedRef.current = true;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await api.get(`/matches/${matchId}`);
        const fresh = res.data?.all_players;
        const list = typeof fresh === 'string' ? JSON.parse(fresh) : fresh;
        if (Array.isArray(list) && list.some((p: any) => p.vitals_t)) {
          if (!cancelled) setPlayers(list);
          return;
        }
      } catch { /* keep polling */ }
      if (attempts < 12 && !cancelled) setTimeout(poll, 8000);
    };

    api.post(`/matches/${matchId}/parse-vitals`).then(() => setTimeout(poll, 8000)).catch(() => { /* silently keep placeholder vitals */ });

    return () => { cancelled = true; };
  }, [matchId, isParsed, allPlayers]);

  return players;
}

function fmtClock(t: number) {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function fmtK(n: number) {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n)}`;
}

function teamTotals(players: any[], currentTime: number) {
  return players.reduce((acc, p) => {
    acc.kills += liveCount(p, 'kills_log', currentTime);
    acc.deaths += liveCount(p, 'deaths_log', currentTime);
    acc.assists += p.assists || 0;
    acc.cs += Math.round(interpAtTime(p.lh_t, currentTime));
    acc.gold += interpAtTime(p.gold_t, currentTime);
    acc.xp += interpAtTime(p.xp_t, currentTime);
    // Heal/Hero Damage/Tower Damage prefer the real per-second
    // reconstruction (vitals_t) over the older, not-always-present
    // per-minute hero_healing_t/hero_damage_t — see PlaybackPlayerRow.tsx.
    // Tower damage has no per-minute fallback anywhere in the app (no
    // "tower_damage_t" field has ever existed), so it only ever
    // contributes once vitals_t's "td" series exists for that player.
    const real = getRealVitals(p, currentTime);
    acc.heal += Math.round(real?.heal ?? interpAtTime(p.hero_healing_t, currentTime));
    acc.dmg += Math.round(real?.dmg ?? interpAtTime(p.hero_damage_t, currentTime));
    if (real?.td != null) acc.td += Math.round(real.td);
    acc.netWorth += interpAtTime(p.networth_t, currentTime) || interpAtTime(p.gold_t, currentTime);
    return acc;
  }, { kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, xp: 0, heal: 0, dmg: 0, td: 0, netWorth: 0 });
}

/** Team-total HP/Mana: sums each player's current vitals (real per-second
 * data from vitals_t when present, otherwise the same max/alive-dead
 * fallback each player row already uses) — a genuinely derived total, not
 * a separate estimate. */
function teamVitals(players: any[], currentTime: number) {
  return players.reduce((acc, p) => {
    const xp = interpAtTime(p.xp_t, currentTime);
    const level = levelFromXp(xp);
    const isDead = getDeadStatus(p, currentTime)?.dead ?? false;
    const real = getRealVitals(p, currentTime);
    const v = real ? { hp: real.hp, mana: real.mana, maxHp: real.maxHp, maxMana: real.maxMana } : getHeroVitals(p, level, !isDead);
    if (v) {
      acc.hp += Math.max(0, v.hp);
      acc.maxHp += v.maxHp;
      acc.mana += Math.max(0, v.mana);
      acc.maxMana += v.maxMana;
    }
    return acc;
  }, { hp: 0, maxHp: 0, mana: 0, maxMana: 0 });
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

/** Compact per-team stats row (team emblem + K/D/A/CS/GPM/XPM/Heal/DMG/TD +
 * team HP/Mana totals + net worth), sized to sit beside the advantage graph
 * rather than spanning the full page width. Values are real (same source
 * as teamTotals's wide table, plus the new teamVitals HP/Mana sums). */
function TeamStatRow({ label, color, Icon, totals, vitals, isLeading, currentTime }: { label: string; color: string; Icon: any; totals: ReturnType<typeof teamTotals>; vitals: ReturnType<typeof teamVitals>; isLeading: boolean; currentTime: number }) {
  const Stat = ({ label: l, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{l}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.5rem 0' }}>
      <div style={{
        flexShrink: 0, width: '56px', height: '56px', borderRadius: '8px',
        background: `${color}1a`, border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 34, height: 34 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isLeading ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{Math.round(totals.netWorth).toLocaleString()} net worth</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px 3px', marginBottom: '4px' }}>
          <Stat label="K/D/A" value={<>{totals.kills}/{totals.deaths}/{totals.assists}</>} />
          <Stat label="CS" value={totals.cs} />
          <Stat label="GPM" value={Math.round(totals.gold / Math.max(1 / 60, currentTime / 60))} />
          <Stat label="XPM" value={Math.round(totals.xp / Math.max(1 / 60, currentTime / 60))} />
          <Stat label="Heal" value={totals.heal ? fmtK(totals.heal) : '-'} />
          <Stat label="Hero DMG" value={totals.dmg ? fmtK(totals.dmg) : '-'} />
          <Stat label="Tower DMG" value={totals.td ? fmtK(totals.td) : '-'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ height: '10px', borderRadius: '2px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--radiant-green)55', overflow: 'hidden' }}>
            <div style={{ width: `${vitals.maxHp > 0 ? Math.min(100, (vitals.hp / vitals.maxHp) * 100) : 0}%`, height: '100%', background: 'var(--radiant-green)' }} />
          </div>
          <div style={{ height: '10px', borderRadius: '2px', background: 'rgba(0,0,0,0.5)', border: '1px solid #4da6ff55', overflow: 'hidden' }}>
            <div style={{ width: `${vitals.maxMana > 0 ? Math.min(100, (vitals.mana / vitals.maxMana) * 100) : 0}%`, height: '100%', background: '#4da6ff' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamHeader({ label, color, Icon }: { label: string; color: string; Icon: any }) {
  return (
    <>
      <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon style={{ width: 18, height: 18 }} /> {label}
      </h4>
      <div style={{ display: 'flex', gap: '1rem', padding: '0 0.9rem', marginBottom: '0.35rem', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        <span style={{ width: '195px', flexShrink: 0 }}>Player / HP / MP</span>
        <span style={{ flex: 1, textAlign: 'center', minWidth: '170px' }}>K/D/A · CS · GPM/XPM · Heal/DMG/TD</span>
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
 * HP/Mana bars: triggers an on-demand backend reconstruction
 * (services/vitals_parser.py, from real combat-log damage/heal instances)
 * the first time this page opens for a match that doesn't have it yet —
 * see useVitalsData below. Until that lands (or if it fails), falls back
 * to a real max (real hero stats + level, lib/heroVitals.ts) with the
 * fill tracking only alive/dead, never a fabricated moment-to-moment
 * curve without the real data to back it.
 */
export default function MatchPlaybackPage({ matchData, allPlayers: allPlayersProp }: { matchData: any; allPlayers: any[] }) {
  const playback = useMatchPlayback(4, matchData?.duration || 0);
  const allPlayers = useVitalsData(matchData?.match_id, !!matchData?.is_parsed, allPlayersProp);
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
  const radVitals = teamVitals(radiant, currentTime);
  const direVitals = teamVitals(dire, currentTime);
  const radLeads = radTotals.netWorth >= direTotals.netWorth;

  return (
    <FullBleed>
      <div className="animate-fade-in">
        <KillTicker allPlayers={allPlayers} currentTime={currentTime} />

        {/* Map on the left, both team stacks on the right, side by side —
            roughly equal width so the map is genuinely big, and wraps to
            stacked on narrower screens instead of squeezing either side. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 460px', minWidth: '420px' }}>
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

          <div style={{ flex: '1 1 620px', display: 'flex', flexWrap: 'wrap', gap: '1rem', minWidth: 0 }}>
            <div style={{ flex: '1 1 340px', minWidth: '340px' }}>
              <TeamHeader label="Radiant" color="var(--radiant-green)" Icon={IconRadiant} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {radiant.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} currentTime={currentTime} />)}
              </div>
            </div>
            <div style={{ flex: '1 1 340px', minWidth: '340px' }}>
              <TeamHeader label="Dire" color="var(--dire-red)" Icon={IconDire} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {dire.map((p: any) => <PlaybackPlayerRow key={p.player_slot} player={p} currentTime={currentTime} />)}
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

        {/* Compact team stats panel + the advantage graph, side by side so
            the panel stays narrow (team emblem, K/D/A/CS/GPM/XPM/Heal/DMG,
            team HP/Mana totals, net worth) instead of spanning full width */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', alignItems: 'stretch' }}>
          <div className="glass-surface" style={{ flex: '1 1 400px', maxWidth: '460px', padding: '0.6rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <TeamStatRow label="Radiant" color="var(--radiant-green)" Icon={IconRadiant} totals={radTotals} vitals={radVitals} isLeading={radLeads} currentTime={currentTime} />
            <div style={{ borderTop: '1px solid var(--border-color)' }} />
            <TeamStatRow label="Dire" color="var(--dire-red)" Icon={IconDire} totals={direTotals} vitals={direVitals} isLeading={!radLeads} currentTime={currentTime} />
          </div>

          {/* Real gold/XP advantage, a moving position bar synced to the
              clock above, and kill markers showing the killed hero's portrait */}
          <div className="glass-surface" style={{ flex: '2 1 600px', minWidth: '480px', padding: '1rem' }}>
            <PlaybackAdvantageGraph matchData={matchData} allPlayers={allPlayers} currentTime={currentTime} height={280} />
          </div>
        </div>
      </div>
    </FullBleed>
  );
}
