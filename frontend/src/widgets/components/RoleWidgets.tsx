import type { ComponentType } from 'react';
import { useApiData } from '../hooks';
import './RoleWidgets.css';

interface RoleBreakdown {
  window: number;
  laning: { matches: number; avg_cs_10min: number; cs_10min_sample_size: number; avg_kda: number; winrate: number };
  support: { matches: number; has_data: boolean; avg_wards_placed: number | null; avg_camps_stacked: number | null; sample_size: number };
  carry: { matches: number; avg_last_hits: number; avg_kda: number; avg_gpm: number };
}

function useRoleBreakdown() {
  return useApiData<RoleBreakdown>('/progress/role-breakdown', { window: 20 });
}

function RoleStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="role-stat">
      <div className="role-stat-label">{label}</div>
      <div className="role-stat-value">{value}</div>
      {sub && <div className="role-stat-sub">{sub}</div>}
    </div>
  );
}

export const LaningWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useRoleBreakdown();
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  const l = data?.laning;
  if (!l || !l.matches) return <div className="widget-chart-empty">No recent matches to compute laning stats from.</div>;
  return (
    <div className="role-stat-grid">
      <RoleStat
        label="CS @ 10 min"
        value={l.cs_10min_sample_size ? `${l.avg_cs_10min}` : '—'}
        sub={l.cs_10min_sample_size ? `${l.cs_10min_sample_size}/${l.matches} parsed games` : 'Needs parsed matches'}
      />
      <RoleStat label="Avg KDA" value={`${l.avg_kda}`} />
      <RoleStat label="Win Rate" value={`${l.winrate}%`} sub={`Last ${l.matches} games`} />
    </div>
  );
};

export const SupportWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useRoleBreakdown();
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  const s = data?.support;
  if (!s || !s.matches) return <div className="widget-chart-empty">No recent matches to compute support stats from.</div>;
  if (!s.has_data) {
    return (
      <div className="widget-chart-empty">
        Ward/camp data needs a locally-parsed replay -- none of your last {s.matches} games have one yet.
      </div>
    );
  }
  return (
    <div className="role-stat-grid">
      <RoleStat label="Avg Wards Placed" value={s.avg_wards_placed != null ? `${s.avg_wards_placed}` : '—'} />
      <RoleStat label="Avg Camps Stacked" value={s.avg_camps_stacked != null ? `${s.avg_camps_stacked}` : '—'} />
      <RoleStat label="Sample Size" value={`${s.sample_size}`} sub={`of last ${s.matches} games`} />
    </div>
  );
};

export const CarryWidget: ComponentType<{ instanceId: string }> = () => {
  const { data, loading } = useRoleBreakdown();
  if (loading) return <div className="widget-chart-empty animate-pulse">Loading…</div>;
  const c = data?.carry;
  if (!c || !c.matches) return <div className="widget-chart-empty">No recent matches to compute carry stats from.</div>;
  return (
    <div className="role-stat-grid">
      <RoleStat label="Avg Last Hits" value={`${c.avg_last_hits}`} />
      <RoleStat label="Avg KDA" value={`${c.avg_kda}`} />
      <RoleStat label="Avg GPM" value={`${c.avg_gpm}`} sub={`Last ${c.matches} games`} />
    </div>
  );
};
