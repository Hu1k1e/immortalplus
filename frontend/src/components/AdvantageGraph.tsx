import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { HEROES } from '../lib/heroes';
import { getHeroImage } from '../lib/dota';

function fmtK(n: number) {
  const sign = n >= 0 ? '+' : '';
  return Math.abs(n) >= 1000 ? `${sign}${(n / 1000).toFixed(1)}k` : `${sign}${Math.round(n)}`;
}

/**
 * Net Worth / XP advantage area chart. Extracted out of MatchTabs.tsx's
 * GraphsTab (which still renders it, unchanged) so it can also be reused
 * next to the embedded Overview playback panel. Optionally overlays a
 * top-of-graph kill-event ribbon and final-advantage summary badges when
 * `allPlayers` is passed in (matching Stratz's advantage graph).
 */
export default function AdvantageGraph({ matchData, allPlayers, height = 400 }: { matchData: any; allPlayers?: any[]; height?: number }) {
  if (!matchData?.radiant_gold_adv || !matchData?.radiant_xp_adv) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Graph data not available.</div>;
  }

  let goldAdv = matchData.radiant_gold_adv;
  let xpAdv = matchData.radiant_xp_adv;
  if (typeof goldAdv === 'string') goldAdv = JSON.parse(goldAdv);
  if (typeof xpAdv === 'string') xpAdv = JSON.parse(xpAdv);

  const advData = goldAdv.map((val: number, idx: number) => ({
    time: idx,
    gold: val,
    xp: xpAdv[idx] || 0
  }));

  const maxAdvVal = Math.max(...advData.map((d: any) => Math.max(Math.abs(d.gold), Math.abs(d.xp))));
  const gradientOffset = () => {
    const dataMax = Math.max(...advData.map((i: any) => Math.max(i.gold, i.xp)));
    const dataMin = Math.min(...advData.map((i: any) => Math.min(i.gold, i.xp)));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };
  const off = gradientOffset();

  const finalGold = goldAdv[goldAdv.length - 1] || 0;
  const finalXp = xpAdv[xpAdv.length - 1] || 0;

  // Kill events for the top ribbon — only time is needed (not position),
  // so this works even though continuous position data doesn't exist.
  const durationMinutes = Math.max(1, advData.length - 1);
  const killEvents: { time: number; heroId: number; isRadiant: boolean }[] = [];
  (allPlayers || []).forEach((p: any) => {
    let log = p.kills_log;
    if (typeof log === 'string') { try { log = JSON.parse(log); } catch { log = []; } }
    if (Array.isArray(log)) {
      log.forEach((e: any) => {
        if (e?.time != null) killEvents.push({ time: e.time, heroId: p.hero_id, isRadiant: p.player_slot < 128 });
      });
    }
  });

  return (
    <div>
      {allPlayers && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', background: finalGold >= 0 ? 'rgba(81,164,69,0.15)' : 'rgba(194,53,43,0.15)', color: finalGold >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
            {fmtK(finalGold)} Gold
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', background: finalXp >= 0 ? 'rgba(81,164,69,0.15)' : 'rgba(194,53,43,0.15)', color: finalXp >= 0 ? 'var(--radiant-green)' : 'var(--dire-red)' }}>
            {fmtK(finalXp)} XP
          </span>
        </div>
      )}

      {allPlayers && killEvents.length > 0 && (
        <div style={{ position: 'relative', height: '18px', margin: '0 30px' }}>
          {killEvents.map((e, i) => {
            const pct = Math.min(100, Math.max(0, (e.time / 60 / durationMinutes) * 100));
            const hero = HEROES[e.heroId];
            return (
              <img
                key={i}
                src={hero ? getHeroImage(hero.img_name) : ''}
                alt={hero?.name || ''}
                title={`${hero?.name || 'Kill'} @ ${Math.floor(e.time / 60)}:${(e.time % 60).toString().padStart(2, '0')}`}
                style={{
                  position: 'absolute', left: `${pct}%`, top: 0, transform: 'translateX(-50%)',
                  width: '16px', height: '10px', objectFit: 'cover', borderRadius: '1px',
                  border: `1px solid ${e.isRadiant ? 'var(--radiant-green)' : 'var(--dire-red)'}`,
                }}
                onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
              />
            );
          })}
        </div>
      )}

      <div style={{ width: '100%', height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={advData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" tickFormatter={(t) => t + ':00'} />
            <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => Math.abs(val) > 1000 ? (Math.abs(val) / 1000).toFixed(1) + 'k' : Math.abs(val).toString()} domain={[-maxAdvVal, maxAdvVal]} />
            <Tooltip
              contentStyle={{ background: '#1a1f26', border: '1px solid var(--border-color)', borderRadius: '4px' }}
              labelFormatter={(label) => label + ':00'}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            <defs>
              <linearGradient id="splitColorGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="var(--accent-gold)" stopOpacity={0.8} />
                <stop offset={off} stopColor="var(--accent-gold)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="splitColorXP" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="#4da6ff" stopOpacity={0.8} />
                <stop offset={off} stopColor="#4da6ff" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="gold" stroke="var(--accent-gold)" strokeWidth={2} fill="url(#splitColorGold)" name="Gold" />
            <Area type="monotone" dataKey="xp" stroke="#4da6ff" strokeWidth={2} fill="url(#splitColorXP)" name="Experience" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
