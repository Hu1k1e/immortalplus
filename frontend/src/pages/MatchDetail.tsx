
import { useParams, Link } from 'react-router-dom';

export default function MatchDetail() {
  const { matchId } = useParams();

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/matches" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          &larr; Back to Matches
        </Link>
      </div>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="gold-text-gradient">Match Analysis</h1>
        <p className="text-secondary">ID: {matchId}</p>
      </header>

      <div className="glass-surface p-4" style={{ padding: '2rem' }}>
        <p className="text-muted">Loading detailed analysis...</p>
      </div>
    </div>
  );
}
