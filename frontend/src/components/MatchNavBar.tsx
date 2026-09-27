import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';
import { getRoleInfo } from '../lib/roles';
import PositionIcon from './PositionIcon';

type FilterMode = 'all' | 'hero' | 'position';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All Matches',
  hero: 'Same Hero',
  position: 'Same Position',
};

// lane_role (1 Safe/2 Mid/3 Off/4 Jungle) is the only role signal the
// matches-list endpoint returns (no position_est there) — mapped onto the
// same position glyphs used elsewhere for a consistent visual language.
const LANE_ROLE_TO_ICON: Record<number, string> = { 1: 'CARRY', 2: 'MID', 3: 'OFF', 4: 'SOFT4' };

interface MatchNavBarProps {
  matchData: any;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(seconds / 60);
  return `${Math.max(1, minutes)}m ago`;
}

function MatchChip({ m, isCurrent, onClick }: { m: any; isCurrent: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const hero = HEROES[m.hero_id];
  const isWin = m.result === 'win';
  const roleInfo = getRoleInfo(m.lane_role);
  const iconShort = m.lane_role != null ? LANE_ROLE_TO_ICON[m.lane_role] : undefined;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${hero?.name || 'Unknown'} — ${isWin ? 'Win' : 'Loss'}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0,
        cursor: isCurrent ? 'default' : 'pointer',
        padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
        background: isCurrent ? 'rgba(226,183,66,0.14)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isCurrent ? 'rgba(226,183,66,0.55)' : 'var(--border-color)'}`,
        opacity: isCurrent ? 1 : 0.55,
        filter: isCurrent ? 'none' : 'grayscale(15%)',
        transition: 'opacity 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ position: 'relative', lineHeight: 0, flexShrink: 0 }}>
        <img
          src={hero ? getHeroImage(hero.img_name) : ''}
          alt={hero?.name || 'hero'}
          style={{ width: '52px', height: '29px', objectFit: 'cover', borderRadius: '3px', display: 'block' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span style={{
          position: 'absolute', bottom: '-3px', right: '-3px',
          fontSize: '0.6rem', fontWeight: 800, lineHeight: 1,
          padding: '1px 4px', borderRadius: '2px',
          color: '#fff', background: isWin ? 'var(--radiant-green)' : 'var(--dire-red)',
        }}>
          {isWin ? 'W' : 'L'}
        </span>
      </div>

      {roleInfo && iconShort && (
        <div title={roleInfo.label}>
          <PositionIcon short={iconShort} size={13} color="var(--text-secondary)" />
        </div>
      )}

      <span style={{
        fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap',
        maxWidth: hovered ? '60px' : '0px', opacity: hovered ? 1 : 0, overflow: 'hidden',
        transition: 'max-width 0.15s, opacity 0.15s',
      }}>
        {timeAgo(m.played_at)}
      </span>
    </div>
  );
}

/**
 * Page-level chrome above the tab bar: a filter dropdown (All Matches / Same
 * Hero / Same Position) plus a strip of recent games to jump between,
 * replacing the old global "Team View" hero-selector bar. Wraps instead of
 * scrolling so the whole pane is always visible at once.
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
    <div className="glass-surface" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
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
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.25rem', zIndex: 20, width: '160px', overflow: 'hidden' }}
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

      <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border-color)', flexShrink: 0 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
        {loading && recentMatches.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</span>
        )}
        {recentMatches.map((m) => (
          <MatchChip
            key={m.match_id}
            m={m}
            isCurrent={m.match_id === matchData.match_id}
            onClick={() => m.match_id !== matchData.match_id && navigate(`/matches/${m.match_id}`)}
          />
        ))}
      </div>
    </div>
  );
}
