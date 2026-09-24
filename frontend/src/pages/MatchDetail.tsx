import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { HEROES, getHeroImgUrl } from '../lib/heroes';

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const [matchData, setMatchData] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [aiCoaching, setAiCoaching] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState('current');

  useEffect(() => {
    fetchMatchData();
  }, [matchId]);

  const fetchMatchData = async () => {
    try {
      const res = await api.get(`/matches/${matchId}`);
      setMatchData(res.data);
      if (res.data.is_analyzed) {
        const analysisRes = await api.get(`/matches/${matchId}/analysis`);
        setAnalysis(analysisRes.data);
        if (analysisRes.data.ai_coaching) {
          setAiCoaching(analysisRes.data.ai_coaching);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    setAnalyzingAi(true);
    setAiError('');
    try {
      const res = await api.post(`/matches/${matchId}/coach`);
      setAiCoaching(res.data);
    } catch (err: any) {
      console.error(err);
      setAiError(err.response?.data?.detail || 'Failed to fetch AI coaching. Check your API key in Settings.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading match details...</div>;
  if (!matchData) return <div style={{ padding: '2rem' }}>Match not found.</div>;

  const hero = HEROES[matchData.hero_id];
  const isWin = matchData.result === 'win';

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/matches" style={{ color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
            &larr; Back to Matches
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {hero && (
              <img 
                src={getHeroImgUrl(hero.img_name)} 
                alt={hero.name}
                style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
              />
            )}
            <h1 style={{ color: isWin ? 'var(--radiant-green)' : 'var(--dire-red)', margin: 0 }}>
              {isWin ? 'Victory' : 'Defeat'}
            </h1>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>
            {matchData.kills} / {matchData.deaths} / {matchData.assists} • {Math.floor(matchData.duration / 60)}:{(matchData.duration % 60).toString().padStart(2, '0')}
          </p>
        </div>
        {!aiCoaching && (
          <button 
            className="btn btn-primary" 
            onClick={handleAiAnalysis}
            disabled={analyzingAi}
          >
            {analyzingAi ? 'AI is analyzing...' : 'Analyze with AI Coach'}
          </button>
        )}
      </header>

      {aiError && (
        <div style={{ padding: '1rem', background: 'rgba(255, 60, 60, 0.1)', border: '1px solid var(--dire-red)', borderRadius: '8px', color: 'var(--dire-red)', marginBottom: '2rem' }}>
          {aiError}
        </div>
      )}

      {aiCoaching && (
        <div className="glass-surface" style={{ padding: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
          <h2 className="gold-text-gradient" style={{ marginBottom: '1rem' }}>AI Coach Analysis</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            "{aiCoaching.overall_summary}"
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Mistakes Identified</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button 
                  className={`btn ${activeTab === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('current')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Your Rank
                </button>
                <button 
                  className={`btn ${activeTab === 'target' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('target')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Target Rank
                </button>
                <button 
                  className={`btn ${activeTab === 'pro' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('pro')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  Pro Level
                </button>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {activeTab === 'current' && aiCoaching.mistakes_current_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  {activeTab === 'target' && aiCoaching.mistakes_target_rank?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  {activeTab === 'pro' && aiCoaching.mistakes_pro_level?.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: '1rem' }}>Action Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {aiCoaching.action_items?.map((item: any, i: number) => (
                  <div key={i} className="card-interactive" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: `4px solid ${item.priority === 1 ? 'var(--dire-red)' : item.priority === 2 ? 'var(--accent-gold)' : 'var(--radiant-green)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{item.category}</span>
                      <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>{item.difficulty}</span>
                    </div>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="glass-surface" style={{ padding: '1.5rem' }}>
            <h3>Laning Score</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.laning_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
              {analysis.laning_score}
            </div>
            <p className="text-secondary">CS at 10m: {analysis.cs_at_10}</p>
          </div>
          <div className="glass-surface" style={{ padding: '1.5rem' }}>
            <h3>Farming Score</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.farming_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
              {analysis.farming_score}
            </div>
          </div>
          <div className="glass-surface" style={{ padding: '1.5rem' }}>
            <h3>Fighting Score</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.fighting_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
              {analysis.fighting_score}
            </div>
          </div>
          <div className="glass-surface" style={{ padding: '1.5rem' }}>
            <h3>Vision Score</h3>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.vision_score > 70 ? 'var(--radiant-green)' : 'var(--accent-gold)' }}>
              {analysis.vision_score}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
