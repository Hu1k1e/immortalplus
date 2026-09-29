import type { ComponentType } from 'react';
import { TrendingUp, Crosshair, Activity, Award, Skull, Gauge, Swords, ListChecks } from 'lucide-react';
import { useApiData } from '../hooks';
import './StatWidgets.css';

interface ProgressSummary {
  recent_winrate: number;
  winrate_change: number;
  recent_kda: number;
  kda_change: number;
  recent_gpm: number;
  gpm_change: number;
  recent_deaths: number;
  deaths_change: number;
  avg_performance_score: number;
  mmr_estimate: number | null;
  active_action_items: unknown[];
}

function trendClass(change: number, invert = false): string {
  const positive = invert ? change < 0 : change > 0;
  const negative = invert ? change > 0 : change < 0;
  if (positive) return 'positive';
  if (negative) return 'negative';
  return 'neutral';
}

function StatCardShell({ icon, label, value, trend, desc, loading }: {
  icon: React.ReactNode; label: string; value: string; trend?: { text: string; cls: string }; desc?: string; loading: boolean;
}) {
  return (
    <div className={`stat-widget ${loading ? 'animate-pulse' : ''}`}>
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon}
      </div>
      <div className="stat-value">{loading ? '—' : value}</div>
      {trend && <div className={`stat-trend ${trend.cls}`}>{trend.text}</div>}
      {desc && <div className="stat-desc">{desc}</div>}
    </div>
  );
}

function useProgressSummary() {
  return useApiData<ProgressSummary>('/progress/summary');
}

export const WinRateStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  const change = data?.winrate_change ?? 0;
  return (
    <StatCardShell
      loading={loading}
      icon={<TrendingUp size={18} className={change >= 0 ? 'text-green' : 'text-red'} />}
      label="Win Rate (Last 20)"
      value={`${data?.recent_winrate ?? 0}%`}
      trend={{ text: `${change > 0 ? '+' : ''}${change}%`, cls: trendClass(change) }}
    />
  );
};

export const KdaStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  const change = data?.kda_change ?? 0;
  return (
    <StatCardShell
      loading={loading}
      icon={<Crosshair size={18} className="text-gold" />}
      label="Avg KDA"
      value={`${data?.recent_kda ?? 0}`}
      trend={{ text: `${change > 0 ? '+' : ''}${change}`, cls: trendClass(change) }}
    />
  );
};

export const GpmStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  const change = data?.gpm_change ?? 0;
  return (
    <StatCardShell
      loading={loading}
      icon={<Activity size={18} className="text-blue" />}
      label="Avg GPM"
      value={`${data?.recent_gpm ?? 0}`}
      trend={{ text: `${change > 0 ? '+' : ''}${change}`, cls: trendClass(change) }}
    />
  );
};

export const DeathsStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  const change = data?.deaths_change ?? 0;
  return (
    <StatCardShell
      loading={loading}
      icon={<Skull size={18} className="text-red" />}
      label="Avg Deaths"
      value={`${data?.recent_deaths ?? 0}`}
      trend={{ text: `${change > 0 ? '+' : ''}${change}`, cls: trendClass(change, true) }}
    />
  );
};

export const PerformanceScoreStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  return (
    <StatCardShell
      loading={loading}
      icon={<Gauge size={18} className="text-purple" />}
      label="Performance Score"
      value={`${data?.avg_performance_score ?? 0}`}
      desc="Avg. of last 10 analyzed matches"
    />
  );
};

export const MmrStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  return (
    <StatCardShell
      loading={loading}
      icon={<Swords size={18} className="text-gold" />}
      label="MMR Estimate"
      value={data?.mmr_estimate != null ? `${data.mmr_estimate}` : '—'}
    />
  );
};

export const ActionItemsStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useProgressSummary();
  return (
    <StatCardShell
      loading={loading}
      icon={<Award size={18} className="text-purple" />}
      label="Action Items"
      value={`${data?.active_action_items?.length ?? 0} Active`}
      desc="Complete to improve"
    />
  );
};

interface PlayerSummary { matches: number; wins: number; losses: number; winrate: number; }

export const TotalMatchesStatWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useApiData<PlayerSummary>('/player/summary');
  return (
    <StatCardShell
      loading={loading}
      icon={<ListChecks size={18} className="text-blue" />}
      label="Total Matches"
      value={`${data?.matches?.toLocaleString() ?? 0}`}
      desc={data ? `${data.wins}W – ${data.losses}L` : undefined}
    />
  );
};
