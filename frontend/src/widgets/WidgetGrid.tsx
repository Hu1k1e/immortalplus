import { useState, useEffect, useMemo, useCallback } from 'react';
import { Pencil, Check, Plus, RotateCcw } from 'lucide-react';
import GridLayoutBase, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout as RGLLayout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import WidgetCard from './WidgetCard';
import AddWidgetPanel from './AddWidgetPanel';
import type { WidgetDefinition, WidgetInstance, GridLayoutItem } from './types';
import './WidgetGrid.css';

const GridLayout = WidthProvider(GridLayoutBase);

const COLS = 12;
const ROW_HEIGHT = 28;
const MARGIN: [number, number] = [16, 16];

function uid(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface WidgetGridProps {
  /** Unique key for this board's localStorage persistence, e.g. "dashboard". */
  storageKey: string;
  registry: WidgetDefinition[];
  defaultInstances: WidgetInstance[];
  defaultLayout: GridLayoutItem[];
}

export default function WidgetGrid({ storageKey, registry, defaultInstances, defaultLayout }: WidgetGridProps) {
  const registryMap = useMemo(() => new Map(registry.map((w) => [w.id, w])), [registry]);
  const widgetsKey = `immortalplus.widgets.${storageKey}.v1`;
  const layoutKey = `immortalplus.widgets.${storageKey}.layout.v1`;

  const [editing, setEditing] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const [widgets, setWidgets] = useState<WidgetInstance[]>(() => {
    try {
      const raw = localStorage.getItem(widgetsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* corrupt storage -- fall back to defaults */ }
    return defaultInstances;
  });

  const [layout, setLayout] = useState<GridLayoutItem[]>(() => {
    try {
      const raw = localStorage.getItem(layoutKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* corrupt storage -- fall back to defaults */ }
    return defaultLayout;
  });

  useEffect(() => {
    try { localStorage.setItem(widgetsKey, JSON.stringify(widgets)); } catch { /* best-effort persistence */ }
  }, [widgets, widgetsKey]);

  useEffect(() => {
    try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch { /* best-effort persistence */ }
  }, [layout, layoutKey]);

  // Newly-added widget instances (from Add Widget, or a fresh install with
  // no saved layout yet) get appended below the current bottom-most row.
  const ensureLayoutForWidgets = useCallback((insts: WidgetInstance[], lay: GridLayoutItem[]): GridLayoutItem[] => {
    const existing = new Set(lay.map((l) => l.i));
    const missing = insts.filter((w) => !existing.has(w.instanceId));
    if (!missing.length) return lay;
    let nextY = lay.reduce((max, l) => Math.max(max, l.y + l.h), 0);
    const added: GridLayoutItem[] = missing.map((w) => {
      const def = registryMap.get(w.widgetId);
      const size = def?.defaultSize ?? { w: 4, h: 6 };
      const item: GridLayoutItem = {
        i: w.instanceId, x: 0, y: nextY, w: size.w, h: size.h,
        minW: size.minW, minH: size.minH, maxW: size.maxW, maxH: size.maxH,
      };
      nextY += size.h;
      return item;
    });
    return [...lay, ...added];
  }, [registryMap]);

  useEffect(() => {
    setLayout((prev) => ensureLayoutForWidgets(widgets, prev));
  }, [widgets, ensureLayoutForWidgets]);

  const handleLayoutChange = useCallback((newLayout: RGLLayout) => {
    setLayout((prev) => newLayout.map((l) => {
      const old = prev.find((p) => p.i === l.i);
      return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: old?.minW, minH: old?.minH, maxW: old?.maxW, maxH: old?.maxH };
    }));
  }, []);

  const addWidget = (widgetId: string) => {
    const def = registryMap.get(widgetId);
    if (!def) return;
    if (def.singleton && widgets.some((w) => w.widgetId === widgetId)) return;
    setWidgets((prev) => [...prev, { instanceId: uid(), widgetId }]);
  };

  const removeWidget = (instanceId: string) => {
    setWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
    setLayout((prev) => prev.filter((l) => l.i !== instanceId));
  };

  const resetToDefault = () => {
    if (!window.confirm('Reset this dashboard to the default layout? Widgets you added, removed, or resized will be lost.')) return;
    setWidgets(defaultInstances);
    setLayout(defaultLayout);
  };

  const layoutById = useMemo(() => new Map(layout.map((l) => [l.i, l])), [layout]);
  const rglLayout: RGLLayout = widgets.map((w) => {
    const l = layoutById.get(w.instanceId);
    if (l) return l;
    const def = registryMap.get(w.widgetId);
    return { i: w.instanceId, x: 0, y: 0, w: def?.defaultSize.w ?? 4, h: def?.defaultSize.h ?? 6 };
  });

  return (
    <div className="widget-grid-page">
      <div className="widget-grid-toolbar">
        {editing && (
          <>
            <span className="widget-grid-editing-hint">Drag a widget to move it, or its bottom-right corner to resize.</span>
            <button type="button" className="btn btn-secondary widget-toolbar-btn" onClick={() => setShowAddPanel(true)}>
              <Plus size={15} /> Add Widget
            </button>
            <button type="button" className="btn btn-secondary widget-toolbar-btn" onClick={resetToDefault}>
              <RotateCcw size={15} /> Reset
            </button>
          </>
        )}
        <button
          type="button"
          className={`widget-edit-toggle ${editing ? 'is-active' : ''}`}
          onClick={() => setEditing((e) => !e)}
          title={editing ? 'Done editing' : 'Edit dashboard'}
        >
          {editing ? <Check size={17} /> : <Pencil size={17} />}
        </button>
      </div>

      <div className={`widget-grid-surface ${editing ? 'is-editing' : ''}`}>
        <GridLayout
          className="widget-grid-layout"
          layout={rglLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={[0, 0]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".widget-drag-handle"
          resizeHandles={['se']}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((w) => {
            const def = registryMap.get(w.widgetId);
            if (!def) return null;
            const Component = def.Component;
            const Icon = def.icon;
            return (
              <div key={w.instanceId} className="widget-grid-item">
                <WidgetCard
                  title={def.title}
                  icon={Icon ? <Icon size={16} className="widget-card-icon" /> : undefined}
                  editing={editing}
                  chromeless={def.chromeless}
                  onRemove={() => removeWidget(w.instanceId)}
                >
                  <Component instanceId={w.instanceId} />
                </WidgetCard>
              </div>
            );
          })}
        </GridLayout>
      </div>

      {showAddPanel && (
        <AddWidgetPanel
          registry={registry}
          placedWidgetIds={widgets.map((w) => w.widgetId)}
          onAdd={addWidget}
          onClose={() => setShowAddPanel(false)}
        />
      )}
    </div>
  );
}
