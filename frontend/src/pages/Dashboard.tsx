import { useState, useEffect } from 'react';
import './Dashboard.css';
import { TrendingUp, Activity, Crosshair, Award } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kdaTrend, setKdaTrend] = useState<any[]>([]);
  const [gpmTrend, setGpmTrend] = useState<any[]>([]);
  const [winrateTrend, setWinrateTrend] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const sumRes = await api.get('/progress/summary');
        setSummary(sumRes.data);

        const [kdaRes, gpmRes, wrRes] = await Promise.all([
          api.get('/progress/trends?stat=kda'),
          api.get('/progress/trends?stat=gpm'),
          api.get('/progress/trends?stat=winrate')
        ]);

        setKdaTrend(kdaRes.data.points || []);
        setGpmTrend(gpmRes.data.points || []);
        
        // Convert winrate 0/1 to rolling percentage for the chart
        const wrPoints = (wrRes.data.points || []).map((p: any) => ({
          ...p,
          rolling_avg_pct: Math.round(p.rolling_avg * 100)
        }));
        setWinrateTrend(wrPoints);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <header className="page-header">
          <h1 className="gold-text-gradient">Welcome back, Coach</h1>
          <p className="text-secondary">Loading your progress...</p>
        </header>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="dashboard">
        <header className="page-header">
          <h1 className="gold-text-gradient">Welcome back, Coach</h1>
          <p className="text-secondary">Please configure your settings and sync matches to get started.</p>
        </header>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-surface" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Match {label}</p>
          <p style={{ margin: 0, fontWeight: 'bold', color: payload[0].stroke }}>
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1 className="gold-text-gradient">Welcome back, Coach</h1>
        <p className="text-secondary">Here's your progress overview for today.</p>
      </header>

      <section className="stats-grid">
        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Win Rate (Last 20)</span>
            <TrendingUp size={18} className={summary.winrate_change >= 0 ? "text-green" : "text-red"} />
          </div>
          <div className="stat-value">{summary.recent_winrate}%</div>
          <div className={`stat-trend ${summary.winrate_change > 0 ? 'positive' : summary.winrate_change < 0 ? 'negative' : 'neutral'}`}>
            {summary.winrate_change > 0 ? '+' : ''}{summary.winrate_change}%
          </div>
        </div>

        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Avg KDA</span>
            <Crosshair size={18} className="text-gold" />
          </div>
          <div className="stat-value">{summary.recent_kda}</div>
          <div className={`stat-trend ${summary.kda_change > 0 ? 'positive' : summary.kda_change < 0 ? 'negative' : 'neutral'}`}>
            {summary.kda_change > 0 ? '+' : ''}{summary.kda_change}
          </div>
        </div>

        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Avg GPM</span>
            <Activity size={18} className="text-blue" />
          </div>
          <div className="stat-value">{summary.recent_gpm || 0}</div>
          <div className={`stat-trend ${summary.gpm_change > 0 ? 'positive' : summary.gpm_change < 0 ? 'negative' : 'neutral'}`}>
            {summary.gpm_change > 0 ? '+' : ''}{summary.gpm_change}
          </div>
        </div>
        
        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Action Items</span>
            <Award size={18} className="text-purple" />
          </div>
          <div className="stat-value">{summary.active_action_items?.length || 0} Active</div>
          <div className="stat-desc">Complete to improve</div>
        </div>
      </section>

      <section style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="glass-surface p-4" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} className="text-green" /> Rolling Win Rate (%)
          </h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={winrateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="match_index" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rolling_avg_pct" name="Win Rate" stroke="var(--radiant-green)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--radiant-green)', stroke: 'var(--bg-color)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-surface p-4" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Crosshair size={18} className="text-gold" /> Rolling KDA
          </h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kdaTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="match_index" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rolling_avg" name="KDA" stroke="var(--accent-gold)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'var(--accent-gold)', stroke: 'var(--bg-color)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-surface p-4" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} className="text-blue" /> Rolling GPM
          </h3>
          <div style={{ height: '250px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gpmTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="match_index" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rolling_avg" name="GPM" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#3b82f6', stroke: 'var(--bg-color)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="recent-matches-preview" style={{ marginTop: '2rem' }}>
        <h2>Recent Matches</h2>
        <div className="glass-surface p-4 card-interactive" style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Want to see your matches in detail?</p>
          <Link to="/matches" className="btn btn-primary" style={{ textDecoration: 'none' }}>View Full Match History</Link>
        </div>
      </section>
    </div>
  );
}
