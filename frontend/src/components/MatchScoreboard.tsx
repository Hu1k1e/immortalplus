import { HEROES, getHeroImgUrl } from '../lib/heroes';

export default function MatchScoreboard({ allPlayers, radiantWin }: { allPlayers: any[], radiantWin: boolean }) {
  if (!allPlayers || allPlayers.length === 0) return null;

  const radiant = allPlayers.filter(p => p.player_slot < 128);
  const dire = allPlayers.filter(p => p.player_slot >= 128);

  const renderTeamTable = (team: any[], isRadiant: boolean) => {
    const isWinner = isRadiant === radiantWin;

    return (
      <div className="glass-surface" style={{ marginBottom: '2rem', overflowX: 'auto', borderTop: `4px solid ${isWinner ? (isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)') : 'var(--border-color)'}` }}>
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
            {isRadiant ? 'Radiant' : 'Dire'} {isWinner && '🏆'}
          </h2>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.8rem 1rem' }}>Player</th>
              <th style={{ padding: '0.8rem 1rem' }}>Lvl</th>
              <th style={{ padding: '0.8rem 1rem' }}>K / D / A</th>
              <th style={{ padding: '0.8rem 1rem' }}>Net</th>
              <th style={{ padding: '0.8rem 1rem' }}>LH / DN</th>
              <th style={{ padding: '0.8rem 1rem' }}>GPM / XPM</th>
              <th style={{ padding: '0.8rem 1rem' }}>DMG</th>
              <th style={{ padding: '0.8rem 1rem' }}>Heal</th>
              <th style={{ padding: '0.8rem 1rem' }}>BLD</th>
              <th style={{ padding: '0.8rem 1rem' }}>Wards</th>
              <th style={{ padding: '0.8rem 1rem' }}>Items</th>
            </tr>
          </thead>
          <tbody>
            {team.map((p, idx) => {
              const hero = HEROES[p.hero_id];
              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    {hero ? (
                      <img 
                        src={getHeroImgUrl(hero.img_name)} 
                        alt={hero.name} 
                        style={{ width: '50px', height: '28px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                      />
                    ) : <div style={{ width: '50px', height: '28px', background: '#333' }}></div>}
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{p.persona || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hero?.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 1rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {p.level}
                    </div>
                  </td>
                  <td style={{ padding: '0.6rem 1rem', fontWeight: 'bold' }}>
                    <span style={{ color: 'var(--radiant-green)' }}>{p.kills}</span> / 
                    <span style={{ color: 'var(--dire-red)' }}> {p.deaths}</span> / 
                    <span style={{ color: 'var(--text-secondary)' }}> {p.assists}</span>
                  </td>
                  <td style={{ padding: '0.6rem 1rem', color: 'var(--accent-gold)' }}>{(p.net_worth / 1000).toFixed(1)}k</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{p.last_hits} / {p.denies}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{p.gpm} / {p.xpm}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{p.hero_damage}</td>
                  <td style={{ padding: '0.6rem 1rem', color: 'var(--radiant-green)' }}>{p.hero_healing || 0}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{p.tower_damage}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>
                    <span style={{ color: '#facc15' }}>{p.obs_placed || 0}</span> / 
                    <span style={{ color: '#3b82f6' }}> {p.sen_placed || 0}</span>
                  </td>
                  <td style={{ padding: '0.6rem 1rem', display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                    {/* Active Items */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                      {p.items?.map((item: string, i: number) => (
                        <div key={`item-${i}`} style={{ width: '30px', height: '22px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                          {item && item !== 'empty' && (
                            <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${item.replace('item_', '')}.png`} alt={item} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Backpack */}
                    {p.backpack && p.backpack.some((i: string) => i && i !== 'empty') && (
                      <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', opacity: 0.7 }}>
                        {p.backpack.map((item: string, i: number) => (
                          <div key={`bp-${i}`} style={{ width: '22px', height: '16px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                            {item && item !== 'empty' && (
                              <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${item.replace('item_', '')}.png`} alt={item} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Neutral */}
                    {p.neutral_item && p.neutral_item !== 'empty' && (
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', marginLeft: '6px', border: '1px solid var(--accent-gold)' }}>
                        <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${p.neutral_item.replace('item_', '')}.png`} alt={p.neutral_item} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '3rem' }}>
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Match Scoreboard</h2>
      {renderTeamTable(radiant, true)}
      {renderTeamTable(dire, false)}

      <style>{`
        .table-row-hover:hover {
          background: rgba(255,255,255,0.05);
        }
      `}</style>
    </div>
  );
}
