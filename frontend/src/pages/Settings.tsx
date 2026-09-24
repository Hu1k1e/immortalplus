import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function Settings() {
  const [steamAccountId, setSteamAccountId] = useState('');
  const [steamApiKey, setSteamApiKey] = useState('');
  const [opendotaApiKey, setOpendotaApiKey] = useState('');
  const [stratzApiToken, setStratzApiToken] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiApiBase, setOpenaiApiBase] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [dataSource, setDataSource] = useState('both');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/settings').then((res) => {
      setSteamAccountId(res.data.steam_account_id ? res.data.steam_account_id.toString() : '');
      setSteamApiKey(res.data.steam_api_key || '');
      setOpendotaApiKey(res.data.opendota_api_key || '');
      setStratzApiToken(res.data.stratz_api_token || '');
      setOpenaiApiKey(res.data.openai_api_key || '');
      setOpenaiApiBase(res.data.openai_api_base || '');
      setOpenaiModel(res.data.openai_model || '');
      setDataSource(res.data.data_source || 'both');
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setMessage('Failed to load settings.');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.put('/settings', {
        steam_account_id: steamAccountId ? parseInt(steamAccountId, 10) : null,
        steam_api_key: steamApiKey,
        opendota_api_key: opendotaApiKey,
        stratz_api_token: stratzApiToken,
        openai_api_key: openaiApiKey,
        openai_api_base: openaiApiBase,
        openai_model: openaiModel,
        data_source: dataSource,
      });
      setMessage('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const generateGsi = async () => {
    try {
      const res = await api.get('/gsi/config');
      const blob = new Blob([res.data.config], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gamestate_integration_immortalplus.cfg';
      a.click();
    } catch (err) {
      console.error(err);
      alert('Failed to generate GSI config.');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading settings...</div>;

  return (
    <div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="gold-text-gradient">Settings</h1>
        <p className="text-secondary">Configure your coaching experience.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-surface" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>API & Account Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              Steam Account ID (32-bit ID) <span style={{ color: 'var(--dire-red)', fontSize: '0.8rem' }}>*Required to sync matches</span>
              <input 
                type="text" 
                value={steamAccountId}
                onChange={(e) => setSteamAccountId(e.target.value)}
                placeholder="e.g. 86745912" 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              Steam API Key (Optional)
              <input 
                type="text" 
                value={steamApiKey}
                onChange={(e) => setSteamApiKey(e.target.value)}
                placeholder="Enter key..." 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              OpenDota API Key (Optional)
              <input 
                type="text" 
                value={opendotaApiKey}
                onChange={(e) => setOpendotaApiKey(e.target.value)}
                placeholder="Enter key..." 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              Stratz API Token (Optional)
              <input 
                type="text" 
                value={stratzApiToken}
                onChange={(e) => setStratzApiToken(e.target.value)}
                placeholder="Enter token..." 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
          </div>
        </div>

        <div className="glass-surface" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>AI Coach Configuration</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Configure your preferred LLM provider for match analysis. Works with OpenAI or any compatible endpoint (e.g. FreeLLMAPI).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              API Base URL (Leave empty for OpenAI)
              <input 
                type="text" 
                value={openaiApiBase}
                onChange={(e) => setOpenaiApiBase(e.target.value)}
                placeholder="e.g. https://api.freellmapi.com/v1" 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              Model Name (e.g. gpt-4o, claude-3-5-sonnet)
              <input 
                type="text" 
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                placeholder="gpt-4o" 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              API Key
              <input 
                type="password" 
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..." 
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
              />
            </label>
          </div>
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Data Sources & Sync</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            Primary Match Data Source
            <select 
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            >
              <option value="both">Both (Prefer Stratz, Fallback OpenDota)</option>
              <option value="stratz">Stratz Only</option>
              <option value="opendota">OpenDota Only</option>
            </select>
          </label>
        </div>
      </div>

      <div className="glass-surface" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Game State Integration (GSI)</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          GSI allows Immortal+ to provide live draft suggestions without reading game memory.
        </p>
        <button onClick={generateGsi} className="btn btn-secondary">Generate GSI Config</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
        {message && <span style={{ color: message.includes('Failed') ? 'var(--dire-red)' : 'var(--radiant-green)' }}>{message}</span>}
      </div>
    </div>
  );
}
