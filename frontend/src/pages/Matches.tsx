import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords, Hash, Trophy, Skull, Clock, Calendar, Coins, Star,
  Flame, Building2, HeartPulse, Crosshair, ShieldOff, ArrowUp, Users, Package,
} from 'lucide-react';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { ITEMS } from '../lib/items';

const AVAILABLE_COLUMNS = [
  { id: 'hero', label: 'Hero', icon: Swords },
  { id: 'match_id', label: 'Match ID', icon: Hash },
  { id: 'result', label: 'Result', icon: Trophy },
  { id: 'kda', label: 'K/D/A', icon: Skull },
  { id: 'duration', label: 'Duration', icon: Clock },
  { id: 'date', label: 'Date', icon: Calendar },
  { id: 'gpm', label: 'GPM', icon: Coins },
  { id: 'xpm', label: 'XPM', icon: Star },
  { id: 'hero_damage', label: 'Hero Damage', icon: Flame },
  { id: 'tower_damage', label: 'Tower Damage', icon: Building2 },
  { id: 'hero_healing', label: 'Hero Healing', icon: HeartPulse },
  { id: 'last_hits', label: 'Last Hits', icon: Crosshair },
  { id: 'denies', label: 'Denies', icon: ShieldOff },
  { id: 'level', label: 'Level', icon: ArrowUp },
  { id: 'party_size', label: 'Party Size', icon: Users },
  { id: 'items', label: 'Items', icon: Package },
];

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['hero', 'match_id', 'result', 'kda', 'duration', 'date']));

  useEffect(() => {
    api.get('/matches').then((res) => {
      setMatches(res.data.matches || []);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const syncMatches = async () => {
    try {
      setLoading(true);
      await api.post('/matches/sync');
      const res = await api.get('/matches');
      setMatches(res.data.matches || []);
    } catch (err) {
      console.error(err);
      alert('Failed to sync matches');
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (item: any) => {
    if (!item || item === 'empty') return null;
    if (typeof item === 'number' || !isNaN(Number(item))) {
      return ITEMS[Number(item)] || String(item).replace('item_', '');
    }
    return String(item).replace('item_', '');
  };

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const newCols = new Set(prev);
      if (newCols.has(colId)) {
        newCols.delete(colId);
      } else {
        newCols.add(colId);
      }
      return newCols;
    });
  };

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="gold-text-gradient">Match History</h1>
          <p className="text-secondary">Review and analyze your recent games.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowColumnsMenu(!showColumnsMenu)}
          >
            Columns
          </button>
          {showColumnsMenu && (
            <div className="glass-surface" style={{ position: 'absolute', top: '100%', right: '150px', marginTop: '0.5rem', zIndex: 10, padding: '1rem', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Visible Columns</div>
              {AVAILABLE_COLUMNS.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(c.id)}
                    onChange={() => toggleColumn(c.id)}
                  />
                  <c.icon size={13} style={{ opacity: 0.7 }} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={syncMatches} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync Recent Matches'}
          </button>
        </div>
      </header>

      <div className="glass-surface matches-table-wrap">
        {loading && matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading match history...</div>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No matches found. Make sure you set your Steam ID in Settings and click Sync.</div>
        ) : (
          <table className="matches-table">
            <thead>
              <tr>
                {AVAILABLE_COLUMNS.map(c => visibleColumns.has(c.id) && (
                  <th key={c.id}>
                    <div className="matches-table-th">
                      <c.icon size={13} className="matches-table-th-icon" />
                      <span>{c.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const hero = HEROES[m.hero_id] || { name: `Unknown (${m.hero_id})`, img_name: 'unknown' };
                return (
                  <tr
                    key={m.match_id}
                    className={`matches-row ${m.result === 'win' ? 'is-win' : m.result === 'loss' ? 'is-loss' : ''}`}
                    onClick={() => navigate(`/matches/${m.match_id}`)}
                  >
                    {AVAILABLE_COLUMNS.map(c => {
                      if (!visibleColumns.has(c.id)) return null;

                      let content: React.ReactNode = m[c.id];

                      if (c.id === 'hero') {
                        content = (
                          <div className="matches-table-hero">
                            <img
                              src={getHeroImage(hero.img_name)}
                              alt={hero.name}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span>{hero.name}</span>
                          </div>
                        );
                      } else if (c.id === 'result') {
                        content = (
                          <span className={m.result === 'win' ? 'matches-result-win' : m.result === 'loss' ? 'matches-result-loss' : ''}>
                            {m.result === 'win' ? 'Win' : m.result === 'loss' ? 'Loss' : 'Unknown'}
                          </span>
                        );
                      } else if (c.id === 'kda') {
                        content = `${m.kills}/${m.deaths}/${m.assists}`;
                      } else if (c.id === 'duration') {
                        content = formatDuration(m.duration);
                      } else if (c.id === 'date') {
                        content = <span style={{ color: 'var(--text-muted)' }}>{m.played_at ? new Date(m.played_at).toLocaleDateString() : 'N/A'}</span>;
                      } else if (c.id === 'party_size') {
                        content = m.party_size || 1;
                      } else if (c.id === 'items') {
                        content = (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {m.items?.map((item: any, i: number) => {
                              const itemName = getItemName(item);
                              return (
                                <div key={i} className="matches-table-item-slot">
                                  {itemName && (
                                    <img src={getItemImage(itemName.replace('item_', ''))} alt={itemName} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      return <td key={c.id}>{content}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
