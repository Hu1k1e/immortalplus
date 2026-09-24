import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function Matches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="gold-text-gradient">Match History</h1>
          <p className="text-secondary">Review and analyze your recent games.</p>
        </div>
        <button className="btn btn-primary" onClick={syncMatches} disabled={loading}>
          {loading ? 'Syncing...' : 'Sync Recent Matches'}
        </button>
      </header>
      
      <div className="glass-surface p-4" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        {loading && matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading match history...</div>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No matches found. Make sure you set your Steam ID or OpenDota API Key in Settings and click Sync.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Match ID</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Hero ID</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Result</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>K/D/A</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Duration</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '1rem', fontWeight: '500' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.match_id} className="card-interactive" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '1rem' }}>{m.match_id}</td>
                  <td style={{ padding: '1rem' }}>Hero {m.hero_id}</td>
                  <td style={{ padding: '1rem', color: m.result === 'win' ? 'var(--radiant-green)' : m.result === 'loss' ? 'var(--dire-red)' : 'var(--text-primary)', fontWeight: 'bold' }}>
                    {m.result === 'win' ? 'Win' : m.result === 'loss' ? 'Loss' : 'Unknown'}
                  </td>
                  <td style={{ padding: '1rem' }}>{m.kills}/{m.deaths}/{m.assists}</td>
                  <td style={{ padding: '1rem' }}>{formatDuration(m.duration)}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {m.played_at ? new Date(m.played_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Analyze</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
