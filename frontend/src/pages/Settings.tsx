import { useState, useEffect } from 'react';
import api from '../lib/api';

interface SecretFieldState {
  isSet: boolean;
  preview: string | null;
}

const EMPTY_SECRET: SecretFieldState = { isSet: false, preview: null };

export default function Settings() {
  const [steamAccountId, setSteamAccountId] = useState('');
  // Secret fields work differently from every other setting here: the
  // backend now never echoes a real key/token back (see routers/
  // settings.py's _mask_secret — a GET returning live credentials in
  // plaintext with no auth was a real, confirmed security finding).
  // `*Saved` holds only whether a value is configured + a short preview
  // for confirmation; the plain `steamApiKey` etc. state is what the
  // user is TYPING as a replacement and starts empty on every load, not
  // pre-filled with the real value (which this page never receives).
  const [steamApiKeySaved, setSteamApiKeySaved] = useState<SecretFieldState>(EMPTY_SECRET);
  const [opendotaApiKeySaved, setOpendotaApiKeySaved] = useState<SecretFieldState>(EMPTY_SECRET);
  const [stratzApiTokenSaved, setStratzApiTokenSaved] = useState<SecretFieldState>(EMPTY_SECRET);
  const [openaiApiKeySaved, setOpenaiApiKeySaved] = useState<SecretFieldState>(EMPTY_SECRET);
  const [steamApiKey, setSteamApiKey] = useState('');
  const [opendotaApiKey, setOpendotaApiKey] = useState('');
  const [stratzApiToken, setStratzApiToken] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiApiBase, setOpenaiApiBase] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [dataSource, setDataSource] = useState('both');
  const [protrackerIntervalMinutes, setProtrackerIntervalMinutes] = useState('30');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/settings').then((res) => {
      setSteamAccountId(res.data.steam_account_id ? res.data.steam_account_id.toString() : '');
      setSteamApiKeySaved(res.data.steam_api_key || EMPTY_SECRET);
      setOpendotaApiKeySaved(res.data.opendota_api_key || EMPTY_SECRET);
      setStratzApiTokenSaved(res.data.stratz_api_token || EMPTY_SECRET);
      setOpenaiApiKeySaved(res.data.openai_api_key || EMPTY_SECRET);
      setOpenaiApiBase(res.data.openai_api_base || '');
      setOpenaiModel(res.data.openai_model || '');
      setDataSource(res.data.data_source || 'both');
      setProtrackerIntervalMinutes(String(res.data.protracker_interval_minutes ?? 30));
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
      const payload: Record<string, unknown> = {
        steam_account_id: steamAccountId ? parseInt(steamAccountId, 10) : null,
        openai_api_base: openaiApiBase,
        openai_model: openaiModel,
        data_source: dataSource,
        protracker_interval_minutes: protrackerIntervalMinutes ? parseInt(protrackerIntervalMinutes, 10) : 30,
      };
      // Secrets: only sent if the user actually typed a replacement —
      // an untouched (empty) field must never overwrite the saved value
      // with blank, since this page no longer has the real value to
      // fall back to. Explicit "Clear" buttons handle real removal.
      if (steamApiKey) payload.steam_api_key = steamApiKey;
      if (opendotaApiKey) payload.opendota_api_key = opendotaApiKey;
      if (stratzApiToken) payload.stratz_api_token = stratzApiToken;
      if (openaiApiKey) payload.openai_api_key = openaiApiKey;

      await api.put('/settings', payload);
      const res = await api.get('/settings');
      setSteamApiKeySaved(res.data.steam_api_key || EMPTY_SECRET);
      setOpendotaApiKeySaved(res.data.opendota_api_key || EMPTY_SECRET);
      setStratzApiTokenSaved(res.data.stratz_api_token || EMPTY_SECRET);
      setOpenaiApiKeySaved(res.data.openai_api_key || EMPTY_SECRET);
      setSteamApiKey('');
      setOpendotaApiKey('');
      setStratzApiToken('');
      setOpenaiApiKey('');
      setMessage('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const clearSecret = async (field: string, resetSaved: (s: SecretFieldState) => void) => {
    if (!confirm('Remove this saved key/token?')) return;
    try {
      await api.put('/settings', { [field]: '' });
      resetSaved(EMPTY_SECRET);
      setMessage('Cleared.');
    } catch (err) {
      console.error(err);
      setMessage('Failed to clear.');
    } finally {
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

  const inputStyle = { padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' };

  const renderSecretField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    saved: SecretFieldState,
    settingsField: string,
    setSaved: (s: SecretFieldState) => void,
  ) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={saved.isSet ? `Saved (${saved.preview}) — enter a new value to replace` : 'Enter key...'}
          style={{ ...inputStyle, flex: 1 }}
        />
        {saved.isSet && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => clearSecret(settingsField, setSaved)}
            title="Remove this saved key/token"
          >
            Clear
          </button>
        )}
      </div>
    </label>
  );

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
            {renderSecretField('Steam API Key (Optional)', steamApiKey, setSteamApiKey, steamApiKeySaved, 'steam_api_key', setSteamApiKeySaved)}
            {renderSecretField('OpenDota API Key (Optional)', opendotaApiKey, setOpendotaApiKey, opendotaApiKeySaved, 'opendota_api_key', setOpendotaApiKeySaved)}
            {renderSecretField('Stratz API Token (Optional)', stratzApiToken, setStratzApiToken, stratzApiTokenSaved, 'stratz_api_token', setStratzApiTokenSaved)}
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
            {renderSecretField('API Key', openaiApiKey, setOpenaiApiKey, openaiApiKeySaved, 'openai_api_key', setOpenaiApiKeySaved)}
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            Meta Data Refresh Interval (minutes)
            <input
              type="number"
              min={5}
              value={protrackerIntervalMinutes}
              onChange={(e) => setProtrackerIntervalMinutes(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', maxWidth: '160px' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              How often the Draft Helper's position data and the Meta tab re-scrape Dota2ProTracker. Default 30 minutes — the same cadence as the rest of the background sync.
            </span>
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
