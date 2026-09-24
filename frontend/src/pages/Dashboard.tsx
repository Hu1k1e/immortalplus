
import './Dashboard.css';
import { TrendingUp, Activity, Crosshair, Award } from 'lucide-react';

export default function Dashboard() {
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
            <TrendingUp size={18} className="text-green" />
          </div>
          <div className="stat-value">55.0%</div>
          <div className="stat-trend positive">+2.5%</div>
        </div>

        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Avg KDA</span>
            <Crosshair size={18} className="text-gold" />
          </div>
          <div className="stat-value">3.42</div>
          <div className="stat-trend positive">+0.12</div>
        </div>

        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Performance Score</span>
            <Activity size={18} className="text-blue" />
          </div>
          <div className="stat-value">82.5</div>
          <div className="stat-trend neutral">0.0</div>
        </div>
        
        <div className="stat-card glass-surface card-interactive">
          <div className="stat-header">
            <span className="stat-label">Action Items</span>
            <Award size={18} className="text-purple" />
          </div>
          <div className="stat-value">3 Active</div>
          <div className="stat-desc">Complete to improve</div>
        </div>
      </section>

      <section className="recent-matches-preview">
        <h2>Recent Matches</h2>
        <div className="glass-surface p-4" style={{ marginTop: '1rem', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-muted">Loading match history...</p>
        </div>
      </section>
    </div>
  );
}
