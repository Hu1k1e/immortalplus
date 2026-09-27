import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

interface MatchMapProps {
  matchData: any;
  selectedPlayer: any;
  compact?: boolean;
  // Optional controlled playback clock. When provided, MatchMap reads/writes
  // through these instead of managing its own state, so a parent
  // (PlaybackSection) can share one clock between the map and a live side
  // panel. Omitted at the other two existing call sites, which keep
  // today's fully self-contained behavior.
  controlledTime?: number;
  controlledIsPlaying?: boolean;
  controlledSpeed?: number;
  onControlledTimeChange?: (t: number) => void;
  onControlledPlayingChange?: (p: boolean) => void;
  onControlledSpeedChange?: (s: number) => void;
  // Start playing automatically once, on mount (only meaningful when this
  // instance owns its own clock, i.e. controlledIsPlaying is not passed).
  autoPlayOnMount?: boolean;
  // Suppress the built-in scrub/play/speed UI when a parent renders its own
  // transport controls driving the same controlled clock (e.g. a
  // page-level sticky bar) — avoids two redundant, easy-to-desync controls.
  hideControls?: boolean;
}

export default function MatchMap({
  matchData, selectedPlayer, compact,
  controlledTime, controlledIsPlaying, controlledSpeed,
  onControlledTimeChange, onControlledPlayingChange, onControlledSpeedChange,
  autoPlayOnMount, hideControls,
}: MatchMapProps) {
  const duration = matchData?.duration || 0;
  const [internalTime, setInternalTime] = useState(0);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState(4);
  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const autoPlayedRef = useRef(false);

  const currentTime = controlledTime !== undefined ? controlledTime : internalTime;
  const isPlaying = controlledIsPlaying !== undefined ? controlledIsPlaying : internalPlaying;
  const playbackSpeed = controlledSpeed !== undefined ? controlledSpeed : internalSpeed;

  // Refs mirroring the latest read values/callback props so the setters
  // below can have a STABLE identity (required — React's own useState
  // setters are always stable, and the tick() loop below depends on that
  // stability to avoid resetting its elapsed-time tracking every frame).
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  const onTimeChangeRef = useRef(onControlledTimeChange);
  useEffect(() => { onTimeChangeRef.current = onControlledTimeChange; }, [onControlledTimeChange]);
  const onPlayingChangeRef = useRef(onControlledPlayingChange);
  useEffect(() => { onPlayingChangeRef.current = onControlledPlayingChange; }, [onControlledPlayingChange]);
  const onSpeedChangeRef = useRef(onControlledSpeedChange);
  useEffect(() => { onSpeedChangeRef.current = onControlledSpeedChange; }, [onControlledSpeedChange]);

  const setCurrentTime = useCallback((updater: number | ((prev: number) => number)) => {
    const prev = currentTimeRef.current;
    const next = typeof updater === 'function' ? (updater as (p: number) => number)(prev) : updater;
    currentTimeRef.current = next;
    if (onTimeChangeRef.current) onTimeChangeRef.current(next);
    else setInternalTime(next);
  }, []);

  const setIsPlaying = useCallback((p: boolean) => {
    if (onPlayingChangeRef.current) onPlayingChangeRef.current(p);
    else setInternalPlaying(p);
  }, []);

  const setPlaybackSpeed = useCallback((s: number) => {
    if (onSpeedChangeRef.current) onSpeedChangeRef.current(s);
    else setInternalSpeed(s);
  }, []);

  // Autoplay once on mount (works for both controlled and uncontrolled
  // clocks — setIsPlaying already routes to whichever one is active).
  useEffect(() => {
    if (autoPlayOnMount && !autoPlayedRef.current && duration > 0) {
      autoPlayedRef.current = true;
      setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayOnMount, duration]);

  // Playback loop
  const tick = useCallback((timestamp: number) => {
    if (!lastTickRef.current) lastTickRef.current = timestamp;
    const elapsed = (timestamp - lastTickRef.current) / 1000; // seconds
    lastTickRef.current = timestamp;

    setCurrentTime(prev => {
      const next = prev + elapsed * playbackSpeed;
      if (next >= duration) {
        setIsPlaying(false);
        return duration;
      }
      return next;
    });

    animRef.current = requestAnimationFrame(tick);
  }, [playbackSpeed, duration, setCurrentTime, setIsPlaying]);

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = 0;
      animRef.current = requestAnimationFrame(tick);
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, tick]);


  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Mini advantage sparkline (gold + XP)
  const goldAdv = matchData?.radiant_gold_adv || [];
  const xpAdv = matchData?.radiant_xp_adv || [];
  const maxGold = Math.max(1, ...goldAdv.map((g: number) => Math.abs(g)), ...xpAdv.map((x: number) => Math.abs(x)));
  const currentMinute = Math.floor(currentTime / 60);

  // Hero movement. Preferred source: `pos_t` — a real x/y sampled every
  // game-second per hero, extracted server-side from the raw parser event
  // stream's "interval" entries (backend/services/position_parser.py).
  // These aren't in odota/parser's aggregated /blob output (its own
  // CreateParsedDataBlob.java discards them), so matches parsed before that
  // extraction existed won't have `pos_t` yet — for those, fall back to a
  // sparse waypoint trail built from whichever event logs happen to carry
  // real x/y (ward placements reliably; kills/runes on some parser
  // versions), interpolated between the nearest known points. Both paths
  // feed the same {time,x,y}[] shape below, so `pos_t` (already ~1
  // point/second) reads as smooth continuous movement without any special
  // casing, and the fallback degrades gracefully to its sparser real data.
  const heroWaypoints = useMemo(() => {
    if (!matchData?.all_players) return new Map<number, { time: number; x: number; y: number; lifeState?: number }[]>();
    const byPlayer = new Map<number, { time: number; x: number; y: number; lifeState?: number }[]>();

    const collect = (playerSlot: number, logArray: any[]) => {
      if (!Array.isArray(logArray)) return;
      logArray.forEach((log) => {
        if (log?.x && log?.y && log?.time != null) {
          const list = byPlayer.get(playerSlot) || [];
          list.push({ time: log.time, x: log.x, y: log.y });
          byPlayer.set(playerSlot, list);
        }
      });
    };

    matchData.all_players.forEach((p: any) => {
      let posT = p.pos_t;
      if (typeof posT === 'string') { try { posT = JSON.parse(posT); } catch { posT = null; } }

      if (posT?.time?.length) {
        const list: { time: number; x: number; y: number; lifeState?: number }[] = [];
        for (let i = 0; i < posT.time.length; i++) {
          if (posT.x[i] != null && posT.y[i] != null) {
            list.push({ time: posT.time[i], x: posT.x[i], y: posT.y[i], lifeState: posT.life_state?.[i] });
          }
        }
        byPlayer.set(p.player_slot, list);
      } else {
        // Sparse fallback — obs_log/sen_log already carry player_slot;
        // kills_log/runes_log don't always, so tag them before collecting.
        collect(p.player_slot, p.obs_log);
        collect(p.player_slot, p.sen_log);
        collect(p.player_slot, p.kills_log);
        collect(p.player_slot, p.runes_log);
      }
    });

    byPlayer.forEach((list) => list.sort((a, b) => a.time - b.time));
    return byPlayer;
  }, [matchData]);

  const heroPositions = useMemo(() => {
    if (!matchData?.all_players) return [];
    const positions: any[] = [];

    matchData.all_players.forEach((p: any) => {
      const waypoints = heroWaypoints.get(p.player_slot);
      if (!waypoints || waypoints.length === 0) return;

      // Find the bounding waypoints around currentTime
      let before: { time: number; x: number; y: number; lifeState?: number } | null = null;
      let after: { time: number; x: number; y: number; lifeState?: number } | null = null;
      for (const wp of waypoints) {
        if (wp.time <= currentTime) before = wp;
        else { after = wp; break; }
      }

      // A dead hero shouldn't sit frozen on the map — take them out
      // entirely until they respawn. life_state 0 = alive, 1/2 = dying/dead
      // (same convention replay_compute.py's life_state_dead already uses).
      // Only enforced when we actually have life_state data (pos_t path);
      // the sparse ward/kill-log fallback never carries it.
      if (before?.lifeState != null && before.lifeState > 0) return;

      let x: number | undefined;
      let y: number | undefined;
      if (before && after) {
        const frac = (currentTime - before.time) / Math.max(1, after.time - before.time);
        x = before.x + (after.x - before.x) * frac;
        y = before.y + (after.y - before.y) * frac;
      } else if (before) {
        x = before.x; y = before.y;
      } else if (after) {
        x = after.x; y = after.y;
      }

      if (x != null && y != null) {
        const left = Math.min(100, Math.max(0, ((x - 64) / 128) * 100));
        const top = Math.min(100, Math.max(0, (1 - ((y - 64) / 128)) * 100));
        positions.push({
          playerSlot: p.player_slot,
          heroId: p.hero_id,
          left,
          top
        });
      }
    });
    return positions;
  }, [matchData, heroWaypoints, currentTime]);

  const mapSize = compact ? '320px' : '100%';

  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const zoomIn = () => setZoom((prev) => Math.min(4, prev + 0.5));
  const zoomOut = () => setZoom((prev) => {
    const next = Math.max(1, prev - 0.5);
    if (next === 1) setPan({ x: 0, y: 0 });
    return next;
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return; // panning only makes sense once zoomed in
    e.preventDefault(); // stop the drag from turning into a text/image selection
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', gap: '8px' }}>
        <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.85rem', fontWeight: 700 }} onClick={zoomOut} disabled={zoom <= 1} title="Zoom out">−</button>
        <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.85rem', fontWeight: 700 }} onClick={zoomIn} disabled={zoom >= 4} title="Zoom in">+</button>
        <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => { setZoom(1); setPan({x: 0, y: 0}); }}>Reset Map</button>
      </div>
      {/* Map Container */}
      <div
        style={{
          position: 'relative',
          width: mapSize,
          maxWidth: '600px',
          aspectRatio: '1/1',
          background: '#0a0a0a',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          margin: compact ? '0' : '0 auto',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{
          width: '100%',
          height: '100%',
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: 'center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}>
          <img 
            src="/assets/images/dota2/Game_map_7.41.jpg" 
            alt="Dota 2 Map"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7, pointerEvents: 'none' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Building markers (simplified) */}
          {/* Tower positions - Radiant */}
          {[
            { x: 18, y: 82, label: 'T1 Bot' },
            { x: 38, y: 62, label: 'T1 Mid' },
            { x: 12, y: 52, label: 'T1 Top' },
          ].map((t, i) => (
            <div key={`rt${i}`} style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: '8px', height: '8px', background: 'var(--radiant-green)', border: '1px solid #000', borderRadius: '2px', transform: 'translate(-50%,-50%)', opacity: 0.6 }} title={t.label} />
          ))}
          {/* Tower positions - Dire */}
          {[
            { x: 88, y: 18, label: 'T1 Top' },
            { x: 62, y: 38, label: 'T1 Mid' },
            { x: 88, y: 48, label: 'T1 Bot' },
          ].map((t, i) => (
            <div key={`dt${i}`} style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, width: '8px', height: '8px', background: 'var(--dire-red)', border: '1px solid #000', borderRadius: '2px', transform: 'translate(-50%,-50%)', opacity: 0.6 }} title={t.label} />
          ))}

          {/* Hero Positions */}
          {heroPositions.map((hp, i) => {
            const isRad = hp.playerSlot < 128;
            const isSelected = selectedPlayer && selectedPlayer.player_slot === hp.playerSlot;
            if (selectedPlayer && !isSelected) return null; // hide others if one selected

            const hero = HEROES[hp.heroId as keyof typeof HEROES] as any;
            return (
              <div
                key={`hero-${i}`}
                style={{
                  position: 'absolute',
                  left: `${hp.left}%`,
                  top: `${hp.top}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isSelected ? '40px' : '30px',
                  height: isSelected ? '40px' : '30px',
                  borderRadius: '50%',
                  border: `2.5px solid ${isRad ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
                  backgroundImage: hero ? `url(${getHeroImage(hero.img_name)})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#333',
                  zIndex: isSelected ? 20 : 15,
                  // Position is now interpolated every frame (see heroPositions
                  // above), so only transition size/border here — transitioning
                  // left/top too would fight the per-frame updates and lag.
                  transition: 'width 0.2s ease, height 0.2s ease, border-color 0.2s ease'
                }}
                title={hero ? hero.localized_name : `Player ${hp.playerSlot}`}
              />
            );
          })}
        </div>

        {/* Time overlay */}
        <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.8)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Playback Controls */}
      {!hideControls && <div style={{ marginTop: '0.75rem', padding: compact ? '0' : '0 0.5rem' }}>
        {/* Timeline slider */}
        <input 
          type="range" 
          min="0" 
          max={duration} 
          value={currentTime} 
          onChange={(e) => { setCurrentTime(Number(e.target.value)); setIsPlaying(false); }}
          style={{ width: '100%', accentColor: 'var(--accent-gold)', height: '4px' }}
        />

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button 
            onClick={() => { setCurrentTime(Math.max(0, currentTime - 30)); }}
            style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            ⏮
          </button>
          <button 
            onClick={() => { setCurrentTime(Math.min(duration, currentTime + 30)); }}
            style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            ⏭
          </button>
          
          {/* Speed selector */}
          {[1, 2, 4, 8].map(s => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              style={{ 
                background: playbackSpeed === s ? 'var(--accent-gold)' : 'transparent', 
                color: playbackSpeed === s ? '#000' : 'var(--text-muted)', 
                border: '1px solid var(--border-color)', 
                padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' 
              }}
            >
              {s}x
            </button>
          ))}

          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>}

      {/* Gold + XP advantage mini sparkline, labels reflecting whichever
          side currently leads each stat (not a fixed "Radiant Advantage"
          title — it flips as the graph does). */}
      {goldAdv.length > 0 && !compact && (() => {
        const goldIdx = Math.min(goldAdv.length - 1, currentMinute);
        const xpIdx = Math.min(xpAdv.length - 1, currentMinute);
        const goldNow = goldAdv[goldIdx] ?? 0;
        const xpNow = xpAdv[xpIdx] ?? 0;
        return (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.3rem' }}>
              <span style={{ color: goldNow >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
                {goldNow >= 0 ? 'Radiant' : 'Dire'} Gold Advantage
              </span>
              <span style={{ color: xpNow >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
                {xpNow >= 0 ? 'Radiant' : 'Dire'} XP Advantage
              </span>
            </div>
            <div style={{ height: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '50%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <svg viewBox={`0 0 ${goldAdv.length} 100`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                <path
                  d={goldAdv.map((g: number, i: number) => `${i === 0 ? 'M' : 'L'} ${i} ${50 - (g / maxGold) * 45}`).join(' ')}
                  fill="none" stroke="var(--accent-gold)" strokeWidth="1.5"
                />
                {xpAdv.length > 0 && (
                  <path
                    d={xpAdv.map((x: number, i: number) => `${i === 0 ? 'M' : 'L'} ${i} ${50 - (x / maxGold) * 45}`).join(' ')}
                    fill="none" stroke="#4da6ff" strokeWidth="1.5"
                  />
                )}
              </svg>
              {currentMinute < goldAdv.length && (
                <div style={{ position: 'absolute', left: `${(currentMinute / goldAdv.length) * 100}%`, top: 0, bottom: 0, width: '2px', background: '#fff', opacity: 0.6 }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.3rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '2px', background: 'var(--accent-gold)', display: 'inline-block' }} /> Gold</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '2px', background: '#4da6ff', display: 'inline-block' }} /> XP</span>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
