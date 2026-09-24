

export default function Settings() {
  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="gold-text-gradient">Settings</h1>
        <p className="text-secondary">Configure your coaching experience.</p>
      </header>

      <div className="glass-surface" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Game State Integration (GSI)</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          GSI allows Immortal+ to provide live draft suggestions without reading game memory.
        </p>
        <button className="btn btn-primary">Generate GSI Config</button>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '2rem 0' }} />

        <h3 style={{ marginBottom: '1.5rem' }}>API Configuration</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            Steam API Key (Optional)
            <input type="text" placeholder="Enter key..." style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
          </label>
        </div>
      </div>
    </div>
  );
}
