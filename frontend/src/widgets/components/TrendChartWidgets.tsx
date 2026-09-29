import type { ComponentType } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApiData } from '../hooks';

interface TrendPoint {
  match_index: number;
  rolling_avg: number;
  value: number;
}

interface TrendResponse {
  points: TrendPoint[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; stroke: string }[]; label?: string | number }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-surface" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Match {label}</p>
        <p style={{ margin: 0, fontWeight: 'bold', color: payload[0].stroke }}>
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const AXIS_LABEL_STYLE = { fill: 'var(--text-muted)', fontSize: 11 };
// A short, deliberate delay before Recharts' own line-draw animation
// starts -- without it, the draw-in plays *underneath* the widget's own
// CSS pop-in/opacity-fade entrance (WidgetGrid.css's `widget-pop-in`,
// staggered per tile) and is mostly or entirely finished by the time the
// card is actually visible, reading as "no animation" even though one
// technically ran.
const LINE_ANIMATION_BEGIN = 300;
const LINE_ANIMATION_DURATION = 1100;

function xAxisLabel(text: string) {
  return { value: text, position: 'insideBottom' as const, offset: -4, ...AXIS_LABEL_STYLE };
}

function yAxisLabel(text: string) {
  return { value: text, angle: -90, position: 'insideLeft' as const, offset: 8, ...AXIS_LABEL_STYLE };
}

function makeProgressTrendWidget(stat: string, seriesName: string, color: string, yLabel?: string): ComponentType<{ instanceId: string }> {
  return function ProgressTrendWidget() {
    const { data, loading } = useApiData<TrendResponse>('/progress/trends', { stat, window: 20 });
    const points = data?.points ?? [];
    if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
    if (!points.length) return <div className="widget-chart-empty">Not enough match data yet.</div>;
    return (
      <div className="widget-chart-fill">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ bottom: 18, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="match_index" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} label={xAxisLabel('Match #')} />
            <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} label={yAxisLabel(yLabel ?? seriesName)} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone" dataKey="rolling_avg" name={seriesName} stroke={color} strokeWidth={3} dot={false}
              activeDot={{ r: 6, fill: color, stroke: 'var(--bg-surface)' }}
              isAnimationActive animationBegin={LINE_ANIMATION_BEGIN} animationDuration={LINE_ANIMATION_DURATION} animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };
}

export const KdaTrendWidget = makeProgressTrendWidget('kda', 'KDA', 'var(--accent-gold)');
export const GpmTrendWidget = makeProgressTrendWidget('gpm', 'GPM', '#3b82f6', 'Gold / Min');
export const XpmTrendWidget = makeProgressTrendWidget('xpm', 'XPM', '#8b5cf6', 'XP / Min');
export const DeathsTrendWidget = makeProgressTrendWidget('deaths', 'Deaths', 'var(--dire-red)');
export const HeroDamageTrendWidget = makeProgressTrendWidget('hero_damage', 'Hero Damage', '#e07b39');
export const TowerDamageTrendWidget = makeProgressTrendWidget('tower_damage', 'Tower Damage', '#5b8fa8');

export const WinRateTrendWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<TrendResponse>('/progress/trends', { stat: 'winrate', window: 20 });
  const points = (data?.points ?? []).map((p) => ({ ...p, rolling_avg_pct: Math.round(p.rolling_avg * 100) }));
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  if (!points.length) return <div className="widget-chart-empty">Not enough match data yet.</div>;
  return (
    <div className="widget-chart-fill">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ bottom: 18, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis dataKey="match_index" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} label={xAxisLabel('Match #')} />
          <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={[0, 100]} label={yAxisLabel('Win Rate (%)')} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone" dataKey="rolling_avg_pct" name="Win Rate" stroke="var(--radiant-green)" strokeWidth={3} dot={false}
            activeDot={{ r: 6, fill: 'var(--radiant-green)', stroke: 'var(--bg-surface)' }}
            isAnimationActive animationBegin={LINE_ANIMATION_BEGIN} animationDuration={LINE_ANIMATION_DURATION} animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface Snapshot {
  date: string;
  mmr_estimate: number | null;
  improvement_score: number | null;
}

function makeSnapshotWidget(dataKey: 'mmr_estimate' | 'improvement_score', seriesName: string, color: string): ComponentType<{ instanceId: string }> {
  return function SnapshotTrendWidget() {
    const { data, loading } = useApiData<Snapshot[]>('/progress/snapshots', { limit: 60, period: 'daily' });
    const points = (data ?? []).filter((s) => s[dataKey] != null);
    if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
    if (!points.length) return <div className="widget-chart-empty">No snapshots recorded yet.</div>;
    return (
      <div className="widget-chart-fill">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ bottom: 18, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} label={xAxisLabel('Date')} />
            <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} label={yAxisLabel(seriesName)} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone" dataKey={dataKey} name={seriesName} stroke={color} strokeWidth={3} dot={false}
              activeDot={{ r: 6, fill: color, stroke: 'var(--bg-surface)' }}
              isAnimationActive animationBegin={LINE_ANIMATION_BEGIN} animationDuration={LINE_ANIMATION_DURATION} animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };
}

export const MmrHistoryWidget = makeSnapshotWidget('mmr_estimate', 'MMR Estimate', 'var(--accent-gold)');
export const ImprovementScoreWidget = makeSnapshotWidget('improvement_score', 'Improvement Score', 'var(--radiant-green)');
