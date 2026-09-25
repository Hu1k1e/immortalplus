import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage } from '../lib/dota';
import { ITEMS } from '../lib/items';

const AVAILABLE_COLUMNS = [
  { id: 'hero', label: 'Hero' },
  { id: 'match_id', label: 'Match ID' },
  { id: 'result', label: 'Result' },
  { id: 'kda', label: 'K/D/A' },
  { id: 'duration', label: 'Duration' },
  { id: 'date', label: 'Date' },
  { id: 'gpm', label: 'GPM' },
  { id: 'xpm', label: 'XPM' },
  { id: 'hero_damage', label: 'Hero Damage' },
  { id: 'tower_damage', label: 'Tower Damage' },
  { id: 'hero_healing', label: 'Hero Healing' },
  { id: 'last_hits', label: 'Last Hits' },
  { id: 'denies', label: 'Denies' },
  { id: 'level', label: 'Level' },
  { id: 'party_size', label: 'Party Size' },
  { id: 'items', label: 'Items' }
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
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <div className="glass-surface" style={{ position: 'absolute', top: '100%', right: '150px', marginTop: '0.5rem', zIndex: 10, padding: '1rem', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Visible Columns</div>
              {AVAILABLE_COLUMNS.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.has(c.id)} 
                    onChange={() => toggleColumn(c.id)} 
                  />
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
      
      <div className="glass-surface p-4" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        {loading && matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading match history...</div>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No matches found. Make sure you set your Steam ID in Settings and click Sync.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                {AVAILABLE_COLUMNS.map(c => visibleColumns.has(c.id) && (
                  <th key={c.id} style={{ padding: '1rem', fontWeight: '500' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const hero = HEROES[m.hero_id] || { name: `Unknown (${m.hero_id})`, img_name: 'unknown' };
                return (
                  <tr 
                    key={m.match_id} 
                    className="card-interactive" 
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'pointer' }}
                    onClick={() => navigate(`/matches/${m.match_id}`)}
                  >
                    {AVAILABLE_COLUMNS.map(c => {
                      if (!visibleColumns.has(c.id)) return null;

                      let content: React.ReactNode = m[c.id];

                      if (c.id === 'hero') {
                        content = (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <img 
                              src={getHeroImage(hero.img_name)} 
                              alt={hero.name}
                              style={{ width: '60px', height: '34px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span style={{ fontWeight: '500' }}>{hero.name}</span>
                          </div>
                        );
                      } else if (c.id === 'result') {
                        content = (
                          <span style={{ color: m.result === 'win' ? 'var(--radiant-green)' : m.result === 'loss' ? 'var(--dire-red)' : 'var(--text-primary)', fontWeight: 'bold' }}>
                            {m.result === 'win' ? 'Win' : m.result === 'loss' ? 'Loss' : 'Unknown'}
                          </span>
                        );
                      } else if (c.id === 'kda') {
                        content = `${m.kills}/${m.deaths}/${m.assists}`;
                      } else if (c.id === 'duration') {
                        content = formatDuration(m.duration);
                      } else if (c.id === 'date') {
                        content = <span style={{ color: 'var(--text-secondary)' }}>{m.played_at ? new Date(m.played_at).toLocaleDateString() : 'N/A'}</span>;
                      } else if (c.id === 'party_size') {
                        content = m.party_size || 1;
                      } else if (c.id === 'items') {
                        content = (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {m.items?.map((item: any, i: number) => {
                              const itemName = getItemName(item);
                              return (
                                <div key={i} style={{ width: '30px', height: '22px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                                  {itemName && (
                                    <img src={getItemImage(itemName.replace('item_', ''))} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      return <td key={c.id} style={{ padding: '1rem' }}>{content}</td>;
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
