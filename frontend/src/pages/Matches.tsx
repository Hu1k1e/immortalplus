

export default function Matches() {
  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="gold-text-gradient">Match History</h1>
        <p className="text-secondary">Review and analyze your recent games.</p>
      </header>
      
      <div className="glass-surface p-4 card-interactive" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '600' }}>Match {8000000000 + i}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>2 hours ago</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ color: i % 2 === 0 ? 'var(--dire-red)' : 'var(--radiant-green)', fontWeight: 'bold' }}>
                {i % 2 === 0 ? 'Loss' : 'Win'}
              </div>
              <button className="btn btn-secondary">Analyze</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
