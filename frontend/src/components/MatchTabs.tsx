import { HEROES, getHeroImgUrl } from '../lib/heroes';

// ================ SHARED HELPERS ================
const fmt = (n: any, d = 0) => (n == null || isNaN(n)) ? '-' : Number(n).toFixed(d);
const fmtK = (n: any) => (n == null || isNaN(n)) ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const pct = (n: any) => (n == null || isNaN(n)) ? '-' : `${(n * 100).toFixed(2)}%`;

const PlayerCell = ({ p }: { p: any }) => {
  const hero = HEROES[p.hero_id];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {hero && <img src={getHeroImgUrl(hero.img_name)} alt={hero.name} style={{ width: '36px', height: '20px', objectFit: 'cover', borderRadius: '2px' }} />}
      <span style={{ fontSize: '0.85rem' }}>{p.persona || 'Anonymous'}</span>
    </div>
  );
};

const th: React.CSSProperties = { padding: '0.5rem 0.8rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.5rem 0.8rem', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' };

const TeamTable = ({ title, players, columns, winner }: { title: string; players: any[]; columns: { key: string; label: string; render: (p: any) => any }[]; winner?: boolean }) => (
  <div style={{ marginBottom: '2rem' }}>
    <h3 style={{ color: title.includes('Radiant') ? 'var(--radiant-green)' : 'var(--dire-red)', marginBottom: '0.5rem' }}>
      {title} {winner && <span style={{ background: 'var(--radiant-green)', color: '#000', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '0.5rem' }}>WINNER</span>}
    </h3>
    <div className="glass-surface" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>PLAYER</th>{columns.map(c => <th key={c.key} style={{ ...th, textAlign: 'center' }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
              <td style={td}><PlayerCell p={p} /></td>
              {columns.map(c => <td key={c.key} style={{ ...td, textAlign: 'center' }}>{c.render(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ================ BENCHMARKS TAB ================
export function BenchmarksTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const benchCols = [
    { key: 'gpm', label: 'GPM', render: (p: any) => {
      const b = p.benchmarks?.gold_per_min;
      return <span>{p.gpm} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b ? pct(b.pct) : ''}</span></span>;
    }},
    { key: 'xpm', label: 'XPM', render: (p: any) => {
      const b = p.benchmarks?.xp_per_min;
      return <span>{p.xpm} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b ? pct(b.pct) : ''}</span></span>;
    }},
    { key: 'kpm', label: 'KPM', render: (p: any) => {
      const b = p.benchmarks?.kills_per_min;
      return <span>{b ? fmt(b.raw, 2) : '-'} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b ? pct(b.pct) : ''}</span></span>;
    }},
    { key: 'dpm', label: 'DPM', render: (p: any) => {
      const b = p.benchmarks?.hero_damage_per_min;
      return <span>{b ? fmt(b.raw, 2) : '-'} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b ? pct(b.pct) : ''}</span></span>;
    }},
    { key: 'hd', label: 'HD', render: (p: any) => fmtK(p.hero_damage) },
    { key: 'td', label: 'TD', render: (p: any) => fmtK(p.tower_damage) },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Benchmarks" players={radiant} columns={benchCols} winner={radiantWin} />
      <TeamTable title="Dire - Benchmarks" players={dire} columns={benchCols} winner={!radiantWin} />
    </div>
  );
}

// ================ PERFORMANCES TAB ================
export function PerformancesTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const getMulti = (p: any) => {
    if (!p.multi_kills) return '-';
    const max = Math.max(...Object.keys(p.multi_kills).map(Number));
    return max > 1 ? max : '-';
  };
  const getStreak = (p: any) => {
    if (!p.kill_streaks) return '-';
    const max = Math.max(...Object.keys(p.kill_streaks).map(Number));
    return max > 2 ? max : '-';
  };

  const perfCols = [
    { key: 'multi', label: 'MULTI', render: (p: any) => getMulti(p) },
    { key: 'streak', label: 'STREAK', render: (p: any) => getStreak(p) },
    { key: 'stuns', label: 'STUNS', render: (p: any) => p.stuns ? fmt(p.stuns, 2) : '-' },
    { key: 'stacked', label: 'STACKED', render: (p: any) => p.camps_stacked || '-' },
    { key: 'dead', label: 'DEAD', render: (_p: any) => '-' },
    { key: 'buybacks', label: 'BUYBACKS', render: (p: any) => p.buyback_count || '-' },
    { key: 'pings', label: 'PNG (M)', render: (p: any) => p.pings || '-' },
    { key: 'biggest_hit', label: 'BIGGEST HIT', render: (p: any) => p.max_hero_hit?.value || '-' },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Performances" players={radiant} columns={perfCols} winner={radiantWin} />
      <TeamTable title="Dire - Performances" players={dire} columns={perfCols} winner={!radiantWin} />
    </div>
  );
}

// ================ LANING TAB ================
export function LaningTab({ allPlayers, radiantWin: _radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const getLaneName = (lane: number | null) => {
    switch (lane) { case 1: return 'Safe'; case 2: return 'Mid'; case 3: return 'Off'; default: return '-'; }
  };

  const laningCols = [
    { key: 'side', label: 'SIDE', render: (p: any) => <span style={{ color: p.player_slot < 128 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>{p.player_slot < 128 ? '☀️' : '🌙'}</span> },
    { key: 'lane', label: 'LANE', render: (p: any) => getLaneName(p.lane) },
    { key: 'eff', label: 'EFF@10', render: (p: any) => p.lane_efficiency_pct ? `${fmt(p.lane_efficiency_pct, 2)}%` : (p.lane_efficiency ? `${fmt(p.lane_efficiency * 100, 2)}%` : '-') },
    { key: 'lh10', label: 'LH@10', render: (p: any) => p.lh_t && p.lh_t.length > 10 ? p.lh_t[10] : (p.lh_t?.length > 0 ? p.lh_t[p.lh_t.length - 1] : '-') },
    { key: 'dn10', label: 'DN@10', render: (p: any) => p.dn_t && p.dn_t.length > 10 ? p.dn_t[10] : '-' },
  ];

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Laning</h2>
      <TeamTable title="All Players" players={allPlayers} columns={laningCols} />
    </div>
  );
}

// ================ COMBAT TAB ================
export function CombatTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const combatCols = [
    { key: 'hd', label: 'HERO DMG', render: (p: any) => fmtK(p.hero_damage) },
    { key: 'td', label: 'TOWER DMG', render: (p: any) => fmtK(p.tower_damage) },
    { key: 'hh', label: 'HEALING', render: (p: any) => fmtK(p.hero_healing) },
    { key: 'tfp', label: 'TF%', render: (p: any) => p.teamfight_participation ? `${fmt(p.teamfight_participation * 100, 0)}%` : '-' },
    { key: 'kills', label: 'K', render: (p: any) => <span style={{ color: 'var(--radiant-green)' }}>{p.kills}</span> },
    { key: 'deaths', label: 'D', render: (p: any) => <span style={{ color: 'var(--dire-red)' }}>{p.deaths}</span> },
    { key: 'assists', label: 'A', render: (p: any) => p.assists },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Combat" players={radiant} columns={combatCols} winner={radiantWin} />
      <TeamTable title="Dire - Combat" players={dire} columns={combatCols} winner={!radiantWin} />
    </div>
  );
}

// ================ FARM TAB ================
export function FarmTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const farmCols = [
    { key: 'lh', label: 'LH/DN', render: (p: any) => `${p.last_hits || 0} / ${p.denies || 0}` },
    { key: 'gpm', label: 'GPM', render: (p: any) => p.gpm },
    { key: 'xpm', label: 'XPM', render: (p: any) => p.xpm },
    { key: 'nw', label: 'NET', render: (p: any) => fmtK(p.net_worth) },
    { key: 'stacked', label: 'STACKED', render: (p: any) => p.camps_stacked || 0 },
    { key: 'runes', label: 'RUNES', render: (p: any) => p.rune_pickups || 0 },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Farm" players={radiant} columns={farmCols} winner={radiantWin} />
      <TeamTable title="Dire - Farm" players={dire} columns={farmCols} winner={!radiantWin} />
    </div>
  );
}

// ================ ITEMS TAB ================
export function ItemsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const renderPurchaseLog = (p: any) => {
    const log = p.purchase_log || [];
    if (!log.length) return <span style={{ color: 'var(--text-muted)' }}>No data</span>;
    return (
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', maxWidth: '400px' }}>
        {log.slice(0, 12).map((item: any, i: number) => {
          const itemName = item.key?.replace('item_', '') || '';
          const mins = Math.floor((item.time || 0) / 60);
          return (
            <div key={i} title={`${itemName} at ${mins}m`} style={{ width: '28px', height: '20px', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
              <img src={`https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`} alt={itemName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
          );
        })}
      </div>
    );
  };

  const itemsCols = [
    { key: 'items', label: 'PURCHASE LOG', render: renderPurchaseLog },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Items" players={radiant} columns={itemsCols} winner={radiantWin} />
      <TeamTable title="Dire - Items" players={dire} columns={itemsCols} winner={!radiantWin} />
    </div>
  );
}

// ================ CASTS TAB ================
export function CastsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const renderAbilities = (p: any) => {
    const uses = p.ability_uses || {};
    const entries = Object.entries(uses).sort(([, a]: any, [, b]: any) => b - a).slice(0, 6);
    if (!entries.length) return <span style={{ color: 'var(--text-muted)' }}>No data</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {entries.map(([name, count]: any) => (
          <div key={name} style={{ fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: 'var(--accent-gold)' }}>{count}x</span>
            <span style={{ color: 'var(--text-secondary)' }}>{name.replace(/_/g, ' ').replace(/^[a-z]+\s/, '')}</span>
          </div>
        ))}
      </div>
    );
  };

  const castsCols = [
    { key: 'abilities', label: 'ABILITY CASTS', render: renderAbilities },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Casts" players={radiant} columns={castsCols} winner={radiantWin} />
      <TeamTable title="Dire - Casts" players={dire} columns={castsCols} winner={!radiantWin} />
    </div>
  );
}

// ================ OBJECTIVES TAB ================
export function ObjectivesTab({ objectives, allPlayers }: { objectives: any[]; allPlayers: any[] }) {
  if (!objectives?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No objectives data available.</div>;

  const getHeroName = (slot: number) => {
    const p = allPlayers.find((x: any) => x.player_slot === slot);
    return p ? HEROES[p.hero_id]?.name || 'Unknown' : 'Unknown';
  };

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

  const buildingKills = objectives.filter((o: any) => o.type === 'building_kill');
  const otherEvents = objectives.filter((o: any) => o.type !== 'building_kill');

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Objectives</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Building Kills</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildingKills.map((o: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-gold)', minWidth: '50px' }}>{formatTime(o.time)}</span>
              <span>{o.key?.replace('npc_dota_', '').replace(/_/g, ' ')}</span>
              {o.player_slot != null && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>by {getHeroName(o.player_slot)}</span>}
            </div>
          ))}
        </div>
      </div>
      {otherEvents.length > 0 && (
        <div className="glass-surface" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Other Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {otherEvents.map((o: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <span style={{ color: 'var(--accent-gold)', minWidth: '50px' }}>{formatTime(o.time)}</span>
                <span>{o.type?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================ VISION TAB ================
export function VisionTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const visionCols = [
    { key: 'obs', label: 'OBS PLACED', render: (p: any) => p.obs_placed || 0 },
    { key: 'sen', label: 'SEN PLACED', render: (p: any) => p.sen_placed || 0 },
    { key: 'obs_log', label: 'OBS COUNT', render: (p: any) => p.obs_log?.length || 0 },
    { key: 'sen_log', label: 'SEN COUNT', render: (p: any) => p.sen_log?.length || 0 },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Vision" players={radiant} columns={visionCols} winner={radiantWin} />
      <TeamTable title="Dire - Vision" players={dire} columns={visionCols} winner={!radiantWin} />
    </div>
  );
}

// ================ ACTIONS TAB ================
export function ActionsTab({ allPlayers, radiantWin }: { allPlayers: any[]; radiantWin: boolean }) {
  const radiant = allPlayers.filter((p: any) => p.player_slot < 128);
  const dire = allPlayers.filter((p: any) => p.player_slot >= 128);

  const actionCols = [
    { key: 'apm', label: 'APM', render: (p: any) => p.actions_per_min || '-' },
    { key: 'pings', label: 'PINGS', render: (p: any) => p.pings || '-' },
    { key: 'runes', label: 'RUNE PICKUPS', render: (p: any) => p.rune_pickups || 0 },
    { key: 'stacked', label: 'CAMPS STACKED', render: (p: any) => p.camps_stacked || 0 },
    { key: 'creeps', label: 'CREEPS STACKED', render: (p: any) => p.creeps_stacked || 0 },
  ];

  return (
    <div className="animation-fade-in">
      <TeamTable title="Radiant - Actions" players={radiant} columns={actionCols} winner={radiantWin} />
      <TeamTable title="Dire - Actions" players={dire} columns={actionCols} winner={!radiantWin} />
    </div>
  );
}

// ================ TEAMFIGHTS TAB ================
export function TeamfightsTab({ teamfights, allPlayers }: { teamfights: any[]; allPlayers: any[] }) {
  if (!teamfights?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No teamfight data available.</div>;

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Teamfights ({teamfights.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {teamfights.map((tf: any, idx: number) => (
          <div key={idx} className="glass-surface" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Teamfight #{idx + 1}</h3>
              <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                <span>⏱ {formatTime(tf.start)} - {formatTime(tf.end)}</span>
                <span>💀 {tf.deaths} deaths</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>PLAYER</th>
                    <th style={{ ...th, textAlign: 'center' }}>DMG</th>
                    <th style={{ ...th, textAlign: 'center' }}>HEAL</th>
                    <th style={{ ...th, textAlign: 'center' }}>GOLD Δ</th>
                    <th style={{ ...th, textAlign: 'center' }}>XP Δ</th>
                    <th style={{ ...th, textAlign: 'center' }}>DEATHS</th>
                    <th style={{ ...th, textAlign: 'center' }}>BB</th>
                  </tr>
                </thead>
                <tbody>
                  {tf.players?.map((tfp: any, pi: number) => {
                    const player = allPlayers[pi];
                    if (!player) return null;
                    return (
                      <tr key={pi}>
                        <td style={td}><PlayerCell p={player} /></td>
                        <td style={{ ...td, textAlign: 'center' }}>{fmtK(tfp.damage)}</td>
                        <td style={{ ...td, textAlign: 'center', color: 'var(--radiant-green)' }}>{fmtK(tfp.healing)}</td>
                        <td style={{ ...td, textAlign: 'center', color: tfp.gold_delta >= 0 ? 'var(--accent-gold)' : 'var(--dire-red)' }}>{tfp.gold_delta >= 0 ? '+' : ''}{tfp.gold_delta}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{tfp.xp_delta >= 0 ? '+' : ''}{tfp.xp_delta}</td>
                        <td style={{ ...td, textAlign: 'center', color: tfp.deaths ? 'var(--dire-red)' : '' }}>{tfp.deaths}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{tfp.buybacks || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================ CHAT TAB ================
export function ChatTab({ chat, allPlayers }: { chat: any[]; allPlayers: any[] }) {
  if (!chat?.length) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>No chat data available.</div>;

  const formatTime = (t: number) => {
    const neg = t < 0;
    const abs = Math.abs(t);
    return `${neg ? '-' : ''}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
  };

  const getPlayer = (slot: number) => allPlayers.find((p: any) => p.player_slot === slot);

  // Only show actual text chat, not chatwheel
  const textChat = chat.filter((c: any) => c.type === 'chat');

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Chat Log</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
        {textChat.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No text chat in this match.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {textChat.map((c: any, i: number) => {
              const player = getPlayer(c.player_slot);
              const hero = player ? HEROES[player.hero_id] : null;
              const isRadiant = (c.player_slot ?? 0) < 128;
              return (
                <div key={i} style={{ display: 'flex', gap: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '50px', fontSize: '0.8rem' }}>{formatTime(c.time)}</span>
                  <span style={{ color: isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {hero?.name || 'Unknown'}:
                  </span>
                  <span style={{ fontSize: '0.85rem' }}>{c.key}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ================ LOG TAB ================
export function LogTab({ allPlayers, matchData }: { allPlayers: any[]; matchData: any }) {
  // Combine all kill events from all players into a unified log
  const events: { time: number; text: string; type: string }[] = [];

  allPlayers.forEach((p: any) => {
    const hero = HEROES[p.hero_id]?.name || 'Unknown';
    (p.kills_log || []).forEach((k: any) => {
      events.push({ time: k.time, text: `${hero} killed an enemy`, type: 'kill' });
    });
  });

  // Add objectives
  (matchData.objectives || []).forEach((o: any) => {
    if (o.type === 'building_kill') {
      events.push({ time: o.time, text: `Building destroyed: ${o.key?.replace('npc_dota_', '').replace(/_/g, ' ')}`, type: 'objective' });
    } else if (o.type === 'CHAT_MESSAGE_FIRSTBLOOD') {
      events.push({ time: o.time, text: 'First Blood!', type: 'firstblood' });
    }
  });

  events.sort((a, b) => a.time - b.time);

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  const colorMap: Record<string, string> = { kill: 'var(--dire-red)', objective: 'var(--accent-gold)', firstblood: '#ff4444' };

  return (
    <div className="animation-fade-in">
      <h2 className="gold-text-gradient" style={{ marginBottom: '1.5rem' }}>Match Log</h2>
      <div className="glass-surface" style={{ padding: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No log data available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.3rem 0.5rem', borderLeft: `3px solid ${colorMap[e.type] || 'var(--text-muted)'}`, background: 'rgba(0,0,0,0.15)', borderRadius: '0 4px 4px 0' }}>
                <span style={{ color: 'var(--text-muted)', minWidth: '50px', fontSize: '0.8rem' }}>{formatTime(e.time)}</span>
                <span style={{ fontSize: '0.85rem' }}>{e.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
