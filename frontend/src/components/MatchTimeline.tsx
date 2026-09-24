import { useMemo } from 'react';
import { Crosshair, ShoppingBag, AlertTriangle, Eye } from 'lucide-react';

interface TimelineEvent {
  time: number;
  type: 'kill' | 'item' | 'ai_item' | 'ward';
  label: string;
  color: string;
  icon: any;
  priority?: number;
}

export default function MatchTimeline({ matchData, aiCoaching }: { matchData: any, aiCoaching: any }) {
  const duration = matchData?.duration || 0;

  const events = useMemo(() => {
    if (!matchData) return [];
    
    const evts: TimelineEvent[] = [];

    // Kills
    if (matchData.kills_log && Array.isArray(matchData.kills_log)) {
      matchData.kills_log.forEach((k: any) => {
        evts.push({
          time: k.time,
          type: 'kill',
          label: `Killed ${k.key.replace('npc_dota_hero_', '')}`,
          color: 'var(--radiant-green)',
          icon: Crosshair
        });
      });
    }

    // Items
    if (matchData.purchase_log && Array.isArray(matchData.purchase_log)) {
      matchData.purchase_log.forEach((i: any) => {
        // Filter out cheap items to avoid cluttering the timeline
        if (!['tpscroll', 'ward_observer', 'ward_sentry', 'clarity', 'flask', 'tango', 'branch'].includes(i.key)) {
          evts.push({
            time: i.time,
            type: 'item',
            label: `Bought ${i.key}`,
            color: 'var(--accent-gold)',
            icon: ShoppingBag
          });
        }
      });
    }

    // Wards
    if (matchData.obs_log && Array.isArray(matchData.obs_log)) {
      matchData.obs_log.forEach((w: any) => {
        evts.push({
          time: w.time,
          type: 'ward',
          label: 'Placed Observer Ward',
          color: '#3b82f6',
          icon: Eye
        });
      });
    }

    // AI Coaching Action Items
    if (aiCoaching?.action_items) {
      aiCoaching.action_items.forEach((item: any) => {
        if (item.timestamp && item.timestamp > 0 && item.timestamp <= duration) {
          evts.push({
            time: item.timestamp,
            type: 'ai_item',
            label: item.text,
            color: item.priority === 1 ? 'var(--dire-red)' : 'var(--accent-gold)',
            icon: AlertTriangle,
            priority: item.priority
          });
        }
      });
    }

    // Sort by time
    return evts.sort((a, b) => a.time - b.time);
  }, [matchData, aiCoaching, duration]);

  if (!matchData || duration === 0) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-surface" style={{ padding: '2rem', marginTop: '2rem' }}>
      <h2 className="gold-text-gradient" style={{ marginBottom: '2rem' }}>Live Playback Timeline</h2>
      
      <div style={{ position: 'relative', height: '150px', width: '100%', marginTop: '2rem' }}>
        {/* The timeline axis */}
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '0', 
          right: '0', 
          height: '4px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '2px',
          transform: 'translateY(-50%)' 
        }}></div>

        {/* The events */}
        {events.map((evt, idx) => {
          const leftPct = Math.max(0, Math.min(100, (evt.time / duration) * 100));
          const isTop = evt.type === 'kill' || evt.type === 'ai_item';
          const IconObj = evt.icon;

          return (
            <div 
              key={idx} 
              className="timeline-event"
              style={{ 
                position: 'absolute', 
                left: `${leftPct}%`, 
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: evt.type === 'ai_item' ? 10 : 1
              }}
            >
              <div 
                className="event-marker"
                style={{
                  width: evt.type === 'ai_item' ? '24px' : '16px',
                  height: evt.type === 'ai_item' ? '24px' : '16px',
                  borderRadius: '50%',
                  background: 'var(--bg-color)',
                  border: `2px solid ${evt.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: evt.type === 'ai_item' ? `0 0 10px ${evt.color}` : 'none'
                }}
                title={`[${formatTime(evt.time)}] ${evt.label}`}
              >
                {evt.type === 'ai_item' && <IconObj size={12} color={evt.color} />}
              </div>

              {/* Tooltip-like label */}
              <div 
                className="event-label"
                style={{
                  position: 'absolute',
                  [isTop ? 'bottom' : 'top']: '100%',
                  left: '50%',
                  transform: `translateX(-50%) ${isTop ? 'translateY(-10px)' : 'translateY(10px)'}`,
                  background: 'rgba(0,0,0,0.8)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${evt.color}`,
                  color: 'white',
                  opacity: evt.type === 'ai_item' ? 1 : 0, // only show AI items by default, hover for others
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s',
                  zIndex: 20
                }}
              >
                <strong>{formatTime(evt.time)}</strong><br/>
                {evt.label}
              </div>
            </div>
          );
        })}

        {/* Time markers every 10 mins */}
        {Array.from({ length: Math.floor(duration / 600) + 1 }).map((_, i) => (
          <div key={i} style={{ 
            position: 'absolute', 
            left: `${((i * 600) / duration) * 100}%`, 
            top: '50%',
            transform: 'translate(-50%, 15px)',
            color: 'var(--text-muted)',
            fontSize: '0.8rem'
          }}>
            {i * 10}m
          </div>
        ))}
      </div>

      <style>{`
        .timeline-event:hover .event-label {
          opacity: 1 !important;
        }
        .timeline-event:hover .event-marker {
          transform: scale(1.2);
          transition: transform 0.2s;
        }
      `}</style>
    </div>
  );
}
