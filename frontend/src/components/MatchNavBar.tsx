import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

type FilterMode = 'all' | 'hero' | 'position';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All Matches',
  hero: 'Same Hero',
  position: 'Same Position',
};

interface MatchNavBarProps {
  matchData: any;
}

/**
 * Page-level chrome above the tab bar: a filter dropdown (All Matches / Same
 * Hero / Same Position) plus a horizontal strip of recent games to jump
 * between, replacing the old global "Team View" hero-selector bar.
 */
export default function MatchNavBar({ matchData }: MatchNavBarProps) {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!matchData) return;
    let cancelled = false;
    setLoading(true);

    const params: Record<string, any> = { limit: 20 };
    if (filterMode === 'hero') params.hero_id = matchData.hero_id;
    if (filterMode === 'position') params.lane_role = matchData.lane_role;

    api.get('/matches', { params })
      .then((res) => {
        if (!cancelled) setRecentMatches(res.data.matches || []);
      })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filterMode, matchData?.hero_id, matchData?.lane_role]);

  if (!matchData) return null;

  return (
    <div className="glass-surface" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', marginBottom: '1rem', overflowX: 'auto' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {FILTER_LABELS[filterMode]} ▾
        </button>
        {menuOpen && (
          <div
            className="glass-surface"
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', zIndex: 20, minWidth: '160px', overflow: 'hidden' }}
          >
            {(Object.keys(FILTER_LABELS) as FilterMode[]).map((mode) => (
              <div
                key={mode}
                onClick={() => { setFilterMode(mode); setMenuOpen(false); }}
                style={{
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  background: filterMode === mode ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: filterMode === mode ? 'var(--accent-gold)' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-elevated)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = filterMode === mode ? 'var(--bg-surface-elevated)' : 'transparent'; }}
              >
                {FILTER_LABELS[mode]}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '28px', background: 'var(--border-color)', flexShrink: 0 }} />

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
        {loading && recentMatches.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</span>
        )}
        {recentMatches.map((m) => {
          const hero = HEROES[m.hero_id];
          const isCurrent = m.match_id === matchData.match_id;
          const isWin = m.result === 'win';
          return (
            <img
              key={m.match_id}
              src={hero ? getHeroImage(hero.img_name) : ''}
              alt={hero?.name || 'hero'}
              title={`${hero?.name || 'Unknown'} — ${isWin ? 'Win' : 'Loss'}`}
              onClick={() => !isCurrent && navigate(`/matches/${m.match_id}`)}
              style={{
                width: '36px',
                height: '20px',
                objectFit: 'cover',
                borderRadius: '3px',
                cursor: isCurrent ? 'default' : 'pointer',
                flexShrink: 0,
                border: `2px solid ${isCurrent ? 'var(--accent-gold)' : isWin ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
                opacity: isCurrent ? 1 : 0.85,
                transition: 'opacity 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.opacity = '0.85'; }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          );
        })}
      </div>
    </div>
  );
}
