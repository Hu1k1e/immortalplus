import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { getRankBadge } from '../lib/rank';
import './ProfileButton.css';

export default function ProfileButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.get('/player/profile').then((res) => {
      const d = res.data;
      setProfile(d && typeof d === 'object' && typeof d.persona_name !== 'undefined' ? d : null);
    }).catch(() => setProfile(null));
  }, []);

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
          src={profile.avatar_url || '/logo.svg'}
          alt=""
          className="profile-button-avatar"
          onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
        />
        {rankBadge && <img src={rankBadge} alt="" className="profile-button-rank" />}
      </div>
      <span className="profile-button-name">{profile.persona_name || 'Player'}</span>
    </button>
  );
}
