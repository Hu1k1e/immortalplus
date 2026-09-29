import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveProfile } from '../hooks/useLiveProfile';
import { getRankBadge } from '../lib/rank';
import './ProfileButton.css';

export default function ProfileButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useLiveProfile();

  if (!profile) return null;

  const rankBadge = getRankBadge(profile.rank_tier);
  const active = location.pathname.startsWith('/profile');

  return (
    <button
      className={`profile-button ${active ? 'active' : ''}`}
      onClick={() => navigate('/profile')}
      title={profile.persona_name || 'Profile'}
    >
      <div className="profile-button-avatar-wrap">
        <img
          src={profile.avatar_url || '/logo.png'}
          alt=""
          className="profile-button-avatar"
          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
        />
        {rankBadge && <img src={rankBadge} alt="" className="profile-button-rank" />}
      </div>
      <span className="profile-button-name">{profile.persona_name || 'Player'}</span>
    </button>
  );
}
