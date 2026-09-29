import './Dashboard.css';
import WidgetGrid from '../widgets/WidgetGrid';
import { WIDGET_REGISTRY, DEFAULT_DASHBOARD_INSTANCES, DEFAULT_DASHBOARD_LAYOUT } from '../widgets/registry';

export default function Dashboard() {
  return (
    <WidgetGrid
      storageKey="dashboard"
      registry={WIDGET_REGISTRY}
      defaultInstances={DEFAULT_DASHBOARD_INSTANCES}
      defaultLayout={DEFAULT_DASHBOARD_LAYOUT}
    />
  );
}
