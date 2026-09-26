import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

interface MatchMapProps {
  matchData: any;
  selectedPlayer: any;
  compact?: boolean;
}

export default function MatchMap({ matchData, selectedPlayer, compact }: MatchMapProps) {
  const duration = matchData?.duration || 0;
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(4);
  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

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
  }, [playbackSpeed, duration]);

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = 0;
      animRef.current = requestAnimationFrame(tick);
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, tick]);

  // Collect all map events
  const events = useMemo(() => {
    if (!matchData) return [];
    const evts: any[] = [];

    const addEvents = (logArray: any[], type: string, color: string, playerSlot: number) => {
      if (logArray && Array.isArray(logArray)) {
        logArray.forEach(log => {
          if (log.x && log.y) {
            const left = Math.min(100, Math.max(0, ((log.x - 64) / 128) * 100));
            const top = Math.min(100, Math.max(0, (1 - ((log.y - 64) / 128)) * 100));
            evts.push({ time: log.time, left, top, type, color, playerSlot, label: log.key || type });
          }
        });
      }
    };

    if (matchData.all_players) {
      matchData.all_players.forEach((p: any) => {
        const isRad = p.player_slot < 128;
        const obs = p.obs_log || [];
        const sen = p.sen_log || [];
        const kills = p.kills_log || [];
        addEvents(obs, 'obs', '#3b82f6', p.player_slot);
        addEvents(sen, 'sen', '#eab308', p.player_slot);
        addEvents(kills, 'kill', isRad ? 'var(--radiant-green)' : 'var(--dire-red)', p.player_slot);
      });
    }
    return evts;
  }, [matchData]);


  const visibleEvents = selectedPlayer 
    ? events.filter(e => e.playerSlot === selectedPlayer.player_slot && e.time <= currentTime)
    : events.filter(e => e.time <= currentTime);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Radiant Advantage graph (gold)
  const goldAdv = matchData?.radiant_gold_adv || [];
  const maxGold = Math.max(1, ...goldAdv.map((g: number) => Math.abs(g)));
  const currentMinute = Math.floor(currentTime / 60);

  // Hero positions based on pos dict {"1": {"x": 123, "y": 123}}
  const heroPositions = useMemo(() => {
    if (!matchData?.all_players) return [];
    const positions: any[] = [];
    
    matchData.all_players.forEach((p: any) => {
      // Find the closest previous minute position if current minute doesn't exist
      // Since pos is sparsely sampled sometimes
      let minStr = String(currentMinute);
      let posData = p.pos ? p.pos[minStr] : null;
      
      // If we don't have exact minute, try to fallback to previous known minute up to 5 mins back
      if (!posData && p.pos) {
        for (let back = currentMinute - 1; back >= Math.max(0, currentMinute - 5); back--) {
          if (p.pos[String(back)]) {
            posData = p.pos[String(back)];
            break;
          }
        }
      }

      if (posData && posData.x && posData.y) {
        const left = Math.min(100, Math.max(0, ((posData.x - 64) / 128) * 100));
        const top = Math.min(100, Math.max(0, (1 - ((posData.y - 64) / 128)) * 100));
        positions.push({
          playerSlot: p.player_slot,
          heroId: p.hero_id,
          left,
          top
        });
      }
    });
    return positions;
  }, [matchData, currentMinute]);

  const mapSize = compact ? '320px' : '100%';

  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom(prev => Math.min(Math.max(1, prev + zoomDelta), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onWheel={handleWheel}
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

          {/* Events overlay */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            {visibleEvents.length > 1 && (
              <polyline 
                points={visibleEvents.sort((a,b) => a.time - b.time).map(e => `${e.left},${e.top}`).join(' ')} 
                fill="none" 
                stroke="var(--accent-gold)" 
                strokeWidth="0.5" 
                strokeDasharray="2,2" 
                opacity="0.6" 
              />
            )}
          </svg>

          {visibleEvents.map((evt, i) => (
            <div
              key={`evt-${i}`}
              style={{
                position: 'absolute',
                left: `${evt.left}%`,
                top: `${evt.top}%`,
                transform: 'translate(-50%, -50%)',
                width: evt.type === 'kill' ? '10px' : '8px',
                height: evt.type === 'kill' ? '10px' : '8px',
                borderRadius: evt.type === 'obs' ? '50%' : evt.type === 'sen' ? '2px' : '50%',
                background: evt.color,
                boxShadow: `0 0 4px ${evt.color}`,
                opacity: (currentTime - evt.time < 120) ? 1 : 0.4,
                transition: 'opacity 0.3s',
                zIndex: evt.type === 'kill' ? 10 : 5,
              }}
              title={`[${formatTime(evt.time)}] ${evt.type}`}
            />
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
                  width: isSelected ? '32px' : '24px',
                  height: isSelected ? '32px' : '24px',
                  borderRadius: '50%',
                  border: `2px solid ${isRad ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  backgroundImage: hero ? `url(${getHeroImage(hero.img_name)})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#333',
                  zIndex: isSelected ? 20 : 15,
                  transition: 'all 0.5s linear' // smooth movement
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
      <div style={{ marginTop: '0.75rem', padding: compact ? '0' : '0 0.5rem' }}>
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
      </div>

      {/* Gold Advantage Mini-Graph */}
      {goldAdv.length > 0 && !compact && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Radiant Advantage</div>
          <div style={{ height: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
            {/* Zero line */}
            <div style={{ position: 'absolute', top: '50%', width: '100%', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
            {/* Graph */}
            <svg viewBox={`0 0 ${goldAdv.length} 100`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <path
                d={goldAdv.map((g: number, i: number) => {
                  const x = i;
                  const y = 50 - (g / maxGold) * 45;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke={goldAdv[goldAdv.length - 1] >= 0 ? '#4ade80' : '#ef4444'}
                strokeWidth="1.5"
              />
            </svg>
            {/* Current time indicator */}
            {currentMinute < goldAdv.length && (
              <div style={{ position: 'absolute', left: `${(currentMinute / goldAdv.length) * 100}%`, top: 0, bottom: 0, width: '2px', background: 'var(--accent-gold)', opacity: 0.8 }} />
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />Obs</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#eab308', display: 'inline-block' }} />Sen</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--radiant-green)', display: 'inline-block' }} />Kills</span>
      </div>
    </div>
  );
}
