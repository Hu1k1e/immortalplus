import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';

/**
 * Net Worth / XP advantage area chart. Extracted out of MatchTabs.tsx's
 * GraphsTab (which still renders it, unchanged) so it can also be reused
 * next to the embedded Overview playback panel.
 */
export default function AdvantageGraph({ matchData, height = 400 }: { matchData: any; height?: number }) {
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

  return (
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
  );
}
