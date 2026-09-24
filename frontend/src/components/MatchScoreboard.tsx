import { HEROES, getHeroImgUrl } from '../lib/heroes';
import { ITEMS } from '../lib/items';

export default function MatchScoreboard({ allPlayers, radiantWin, onPlayerClick, compact }: { allPlayers: any[], radiantWin: boolean, onPlayerClick?: (player: any) => void, compact?: boolean }) {
  if (!allPlayers || allPlayers.length === 0) return null;

  const radiant = allPlayers.filter(p => p.player_slot < 128);
  const dire = allPlayers.filter(p => p.player_slot >= 128);

  const getItemName = (item: any) => {
    if (!item || item === 'empty') return null;
    if (typeof item === 'number' || !isNaN(Number(item))) {
      return ITEMS[Number(item)] || String(item).replace('item_', '');
    }
    return String(item).replace('item_', '');
  };

  const renderTeamTable = (team: any[], isRadiant: boolean) => {
    const isWinner = isRadiant === radiantWin;
    const thStyle = { padding: compact ? '0.4rem 0.2rem' : '0.8rem 1rem', fontSize: compact ? '0.7rem' : '0.85rem' };
    const tdStyle = { padding: compact ? '0.3rem 0.2rem' : '0.6rem 1rem', fontSize: compact ? '0.75rem' : '1rem' };

    return (
      <div className="glass-surface" style={{ marginBottom: compact ? '1rem' : '2rem', overflowX: compact ? 'visible' : 'auto', borderTop: `4px solid ${isWinner ? (isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)') : 'var(--border-color)'}` }}>
        <div style={{ padding: compact ? '0.5rem' : '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)', fontSize: compact ? '1rem' : '1.5rem' }}>
            {isRadiant ? 'Radiant' : 'Dire'} {isWinner && '🏆'}
          </h3>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: compact ? 'auto' : '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Player</th>
              <th style={thStyle}>Lvl</th>
              <th style={thStyle}>K</th>
              <th style={thStyle}>D</th>
              <th style={thStyle}>A</th>
              <th style={thStyle}>Net</th>
              <th style={thStyle}>LH/DN</th>
              <th style={thStyle}>G/X</th>
              {!compact && <th style={thStyle}>DMG</th>}
              {!compact && <th style={thStyle}>Heal</th>}
              {!compact && <th style={thStyle}>BLD</th>}
              <th style={thStyle}>Items</th>
            </tr>
          </thead>
          <tbody>
            {team.map((p, idx) => {
              const hero = HEROES[p.hero_id];
              return (
                <tr 
                  key={idx} 
                  onClick={() => onPlayerClick && onPlayerClick(p)}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', cursor: onPlayerClick ? 'pointer' : 'default' }} 
                  className="table-row-hover"
                >
                  <td style={{ ...tdStyle, textAlign: 'left', display: 'flex', alignItems: 'center', gap: compact ? '0.4rem' : '0.8rem' }}>
                    {hero ? (
                      <img 
                        src={getHeroImgUrl(hero.img_name)} 
                        alt={hero.name} 
                        style={{ width: compact ? '35px' : '50px', height: compact ? '20px' : '28px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                      />
                    ) : <div style={{ width: compact ? '35px' : '50px', height: compact ? '20px' : '28px', background: '#333' }}></div>}
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: compact ? '0.75rem' : '1rem' }}>{p.persona || 'Anonymous'}</div>
                      {!compact && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hero?.name}</div>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ width: compact ? '20px' : '28px', height: compact ? '20px' : '28px', borderRadius: '50%', border: '2px solid var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? '0.65rem' : '0.85rem', fontWeight: 'bold', margin: '0 auto' }}>
                      {p.level}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--radiant-green)', fontWeight: 'bold' }}>{p.kills}</td>
                  <td style={{ ...tdStyle, color: 'var(--dire-red)', fontWeight: 'bold' }}>{p.deaths}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontWeight: 'bold' }}>{p.assists}</td>
                  <td style={{ ...tdStyle, color: 'var(--accent-gold)' }}>{(p.net_worth / 1000).toFixed(1)}k</td>
                  <td style={tdStyle}>{p.last_hits} / {p.denies}</td>
                  <td style={tdStyle}>{p.gpm} / {p.xpm}</td>
                  {!compact && <td style={tdStyle}>{p.hero_damage}</td>}
                  {!compact && <td style={{ ...tdStyle, color: 'var(--radiant-green)' }}>{p.hero_healing || 0}</td>}
                  {!compact && <td style={tdStyle}>{p.tower_damage}</td>}
                  <td style={{ ...tdStyle, display: 'flex', gap: compact ? '0.1rem' : '0.2rem', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Active Items */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
                      {p.items?.map((item: any, i: number) => {
                        const itemName = getItemName(item);
                        return (
                          <div key={`item-${i}`} style={{ width: compact ? '20px' : '30px', height: compact ? '14px' : '22px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                            {itemName && (
                              <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName.replace('item_', '')}.png`} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Backpack */}
                    {!compact && p.backpack && p.backpack.some((i: any) => getItemName(i)) && (
                      <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', opacity: 0.7 }}>
                        {p.backpack.map((item: any, i: number) => {
                          const itemName = getItemName(item);
                          return (
                            <div key={`bp-${i}`} style={{ width: '22px', height: '16px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                              {itemName && (
                                <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName.replace('item_', '')}.png`} alt={itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Neutral */}
                    {getItemName(p.neutral_item) && (
                      <div style={{ width: compact ? '16px' : '24px', height: compact ? '16px' : '24px', borderRadius: '50%', overflow: 'hidden', marginLeft: compact ? '2px' : '6px', border: '1px solid var(--accent-gold)' }}>
                        <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${getItemName(p.neutral_item)!.replace('item_', '')}.png`} alt={getItemName(p.neutral_item) || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
