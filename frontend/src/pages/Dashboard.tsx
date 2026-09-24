import { useState, useEffect } from 'react';
import './Dashboard.css';
import { TrendingUp, TrendingDown, Activity, Crosshair, Award } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/progress/summary').then((res) => {
      setSummary(res.data);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
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
            <span className="stat-label">Performance Score</span>
            <Activity size={18} className="text-blue" />
          </div>
          <div className="stat-value">{summary.avg_performance_score || 'N/A'}</div>
          <div className="stat-trend neutral">vs. Benchmark</div>
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

      <section className="recent-matches-preview">
        <h2>Recent Matches</h2>
        <div className="glass-surface p-4 card-interactive" style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Want to see your matches in detail?</p>
          <Link to="/matches" className="btn btn-primary" style={{ textDecoration: 'none' }}>View Full Match History</Link>
        </div>
      </section>
    </div>
  );
}
