import { useMemo } from 'react';
import { Eye, Crosshair } from 'lucide-react';

interface MatchMapProps {
  matchData: any;
  selectedPlayer: any;
}

export default function MatchMap({ matchData, selectedPlayer }: MatchMapProps) {
  const events = useMemo(() => {
    if (!matchData) return [];

    const evts: any[] = [];

    // Helper to get coordinates
    const addEvent = (logArray: any[], type: string, color: string, Icon: any, isSelectedHero: boolean = false) => {
      if (logArray && Array.isArray(logArray)) {
        logArray.forEach(log => {
          if (log.x && log.y) {
            // OpenDota coords: 64 to 192 (128x128 grid)
            const left = Math.min(100, Math.max(0, ((log.x - 64) / 128) * 100));
            const top = Math.min(100, Math.max(0, (1 - ((log.y - 64) / 128)) * 100));
            
            evts.push({
              time: log.time,
              left,
              top,
              type,
              color,
              Icon,
              isSelectedHero,
              label: log.key || type
            });
          }
        });
      }
    };

    if (selectedPlayer) {
      // Show ONLY the selected player's events
      const p = selectedPlayer;
      const isPrimary = p.player_slot === matchData.player_slot;
      const obs = p.obs_log || (isPrimary ? matchData.obs_log : []);
      const sen = p.sen_log || (isPrimary ? matchData.sen_log : []);
      const kills = p.kills_log || (isPrimary ? matchData.kills_log : []);
      
      addEvent(obs, 'Observer Ward', '#3b82f6', Eye, true);
      addEvent(sen, 'Sentry Ward', '#eab308', Eye, true);
      addEvent(kills, 'Kill', 'var(--radiant-green)', Crosshair, true);
    } else {
      // Show events for ALL players
      if (matchData.all_players) {
        matchData.all_players.forEach((p: any) => {
          const isPrimary = p.player_slot === matchData.player_slot;
          const isRadiant = p.player_slot < 128;
          const obs = p.obs_log || (isPrimary ? matchData.obs_log : []);
          const kills = p.kills_log || (isPrimary ? matchData.kills_log : []);

          addEvent(obs, 'Observer Ward', isRadiant ? '#3b82f6' : '#60a5fa', Eye, false);
          addEvent(kills, 'Kill', isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)', Crosshair, false);
        });
      }
    }

    return evts;
  }, [matchData, selectedPlayer]);

  if (!matchData || events.length === 0) {
    return (
      <div className="glass-surface" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>Map data is not available. The match might not be fully parsed yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-surface" style={{ padding: '1rem', width: '100%', maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <h3 className="gold-text-gradient" style={{ marginBottom: '1rem', textAlign: 'center' }}>
        {selectedPlayer ? `${selectedPlayer.persona || 'Hero'} Activity Map` : 'Global Activity Map'}
      </h3>
      
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#111', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
        {/* Dota 2 Map Background */}
        <img 
          src="https://cdn.stratz.com/images/dota2/map/map_7.33.png" 
          alt="Dota 2 Map"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
        />

        {/* Overlays */}
        {events.map((evt, i) => (
          <div 
            key={i}
            className="map-event"
            style={{
              position: 'absolute',
              left: `${evt.left}%`,
              top: `${evt.top}%`,
              transform: 'translate(-50%, -50%)',
              width: evt.isSelectedHero ? '14px' : '10px',
              height: evt.isSelectedHero ? '14px' : '10px',
              borderRadius: '50%',
              background: evt.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: `0 0 5px ${evt.color}`,
              zIndex: evt.type.includes('Kill') ? 10 : 5
            }}
            title={`[${Math.floor(evt.time / 60)}:${(evt.time % 60).toString().padStart(2, '0')}] ${evt.label}`}
          >
            {evt.isSelectedHero && <evt.Icon size={8} color="#000" />}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></div>
          Observer
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
          Sentry
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--radiant-green)' }}></div>
          Kills
        </div>
      </div>
    </div>
  );
}
