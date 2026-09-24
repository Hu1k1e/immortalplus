

export default function DraftHelper() {
  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="gold-text-gradient">Live Draft Helper</h1>
        <p className="text-secondary">Waiting for Dota 2 draft phase to begin...</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-surface card-interactive" style={{ padding: '1.5rem', minHeight: '300px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--radiant-green)' }}>Your Team</h3>
          <p className="text-muted">No heroes selected yet.</p>
        </div>

        <div className="glass-surface card-interactive" style={{ padding: '1.5rem', minHeight: '300px' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--dire-red)' }}>Enemy Team</h3>
          <p className="text-muted">No heroes selected yet.</p>
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '1.5rem', marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Suggested Picks</h2>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '150px' }}>
          <p className="text-muted animate-pulse">Analyzing meta and matchups...</p>
        </div>
      </div>
    </div>
  );
}
