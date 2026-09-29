import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Pencil, Check, Plus, RotateCcw } from 'lucide-react';
import GridLayoutBase, { WidthProvider } from 'react-grid-layout/legacy';
import type { Layout as RGLLayout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import WidgetCard from './WidgetCard';
import AddWidgetPanel from './AddWidgetPanel';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import type { WidgetDefinition, WidgetInstance, GridLayoutItem } from './types';
import './WidgetGrid.css';

const GridLayout = WidthProvider(GridLayoutBase);

const COLS = 12;
const ROW_HEIGHT = 28;
const MARGIN: [number, number] = [16, 16];

function uid(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Tablet/mobile responsiveness: react-grid-layout's non-Responsive
 * component takes a fixed `cols` and doesn't rescale item x/w on its own
 * when that changes, so a saved 12-col layout renders down to fewer
 * columns via this proportional remap for *display only* -- the
 * persisted `layout` state always stays in 12-col terms. Editing
 * (drag/resize) is only offered at the full 12-col width; at narrower
 * widths the board is still fully interactive to read/click, just not
 * rearrangeable (the same trade-off most drag-and-drop dashboards make
 * on touch/narrow viewports). */
function useResponsiveCols(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    // Debounced: a headless screenshot tool (or a browser mid-resize) can
    // report a single-frame, effectively-zero `innerWidth` reading before
    // settling back to the real value. Reacting to that immediately would
    // flip `cols` down to the mobile breakpoint and back within one tick,
    // and react-grid-layout doesn't cleanly recover from a `cols` value
    // that round-trips that fast -- its internal layout state and ours
    // end up permanently disagreeing about item widths, each "correcting"
    // the other forever. Only commit a width once it's held for a beat.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, []);
  if (width < 640) return 3;
  if (width < 1024) return 6;
  return COLS;
}

function rescaleLayout(layout: readonly GridLayoutItem[], fromCols: number, toCols: number): GridLayoutItem[] {
  if (fromCols === toCols) return [...layout];
  const ratio = toCols / fromCols;
  return layout.map((l) => ({
    ...l,
    x: Math.max(0, Math.min(toCols - 1, Math.round(l.x * ratio))),
    w: Math.max(1, Math.min(toCols, Math.round(l.w * ratio))),
  }));
}

/** First-open-gap placement for a newly added widget, instead of always
 * appending below everything else -- scans row-by-row, column-by-column
 * for the first position the new widget's w×h fits without overlapping
 * an existing item, falling back to the bottom only if the grid has no
 * gaps left to fill. */
function findFirstFit(layout: GridLayoutItem[], w: number, h: number, cols: number): { x: number; y: number } {
  const collides = (x: number, y: number) => layout.some((l) =>
    x < l.x + l.w && x + w > l.x && y < l.y + l.h && y + h > l.y);
  const maxY = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= cols - w; x++) {
      if (!collides(x, y)) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

/** Value equality on the fields that matter for rendering (position/size),
 * ignoring incidental object-identity churn. Used to bail out of
 * `setLayout` when nothing actually changed -- react-grid-layout re-fires
 * `onLayoutChange` on effectively every render once anything about the
 * `layout` prop's *reference* changes, so without this bail-out a state
 * update here triggers a re-render that produces a new `layout` prop
 * reference, which triggers another `onLayoutChange` call, forever. */
function layoutsEqual(a: GridLayoutItem[], b: GridLayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byId.get(item.i);
    return !!other && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h;
  });
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
  const [pendingScrollTo, setPendingScrollTo] = useState<string | null>(null);
  const cols = useResponsiveCols();
  const isDesktopWidth = cols === COLS;
  // react-grid-layout can invoke a stale `onLayoutChange` closure from a
  // brief intermediate render (e.g. a transient viewport-width flicker,
  // as happens under headless full-page-screenshot capture) after `cols`
  // has already changed back -- reading this ref instead of the
  // `isDesktopWidth` closure means the bail-out below always sees the
  // *current* value, not whatever was captured when that particular
  // callback instance was created.
  const isDesktopWidthRef = useRef(isDesktopWidth);
  isDesktopWidthRef.current = isDesktopWidth;

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

  // One-time reconciliation for widget instances (loaded from localStorage,
  // possibly from an older app version) that don't have a matching layout
  // entry. Deliberately NOT a recurring effect keyed on `widgets` -- every
  // other place that adds a widget (addWidget, resetToDefault) updates
  // `widgets` and `layout` together in the same handler, so a reactive
  // effect here would just be a second writer racing react-grid-layout's
  // own onLayoutChange-driven updates over the exact same state, which
  // previously produced an infinite render loop (the two disagreeing about
  // a new item's position, each "correcting" the other forever).
  useEffect(() => {
    setLayout((prev) => {
      const existing = new Set(prev.map((l) => l.i));
      const missing = widgets.filter((w) => !existing.has(w.instanceId));
      if (!missing.length) return prev;
      let nextY = prev.reduce((max, l) => Math.max(max, l.y + l.h), 0);
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
      return [...prev, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLayoutChange = useCallback((newLayout: RGLLayout) => {
    // Only the full-width (12-col) render reflects real, persistable
    // positions -- at narrower responsive breakpoints the grid is fed a
    // proportionally-rescaled *display* layout (see rescaleLayout), and
    // editing is disabled there anyway, so any onLayoutChange firing from
    // react-grid-layout's own compaction pass at those widths must be
    // ignored rather than merged back into the canonical 12-col state.
    if (!isDesktopWidthRef.current) return;
    setLayout((prev) => {
      const merged = newLayout.map((l) => {
        const old = prev.find((p) => p.i === l.i);
        return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: old?.minW, minH: old?.minH, maxW: old?.maxW, maxH: old?.maxH };
      });
      return layoutsEqual(merged, prev) ? prev : merged;
    });
  }, []);

  const addWidget = (widgetId: string) => {
    const def = registryMap.get(widgetId);
    if (!def) return;
    if (def.singleton && widgets.some((w) => w.widgetId === widgetId)) return;
    const instanceId = uid();
    setWidgets((prev) => [...prev, { instanceId, widgetId }]);
    // Placed in the same handler as the widgets-state update above (not a
    // reactive effect keyed on `widgets`) so react-grid-layout only ever
    // sees one authoritative position for the new item -- see the mount
    // effect above for why a second writer here caused an infinite loop.
    setLayout((prev) => {
      const size = def.defaultSize;
      const { x, y } = findFirstFit(prev, size.w, size.h, COLS);
      return [...prev, {
        i: instanceId, x, y, w: size.w, h: size.h,
        minW: size.minW, minH: size.minH, maxW: size.maxW, maxH: size.maxH,
      }];
    });
    setPendingScrollTo(instanceId);
    setShowAddPanel(false);
  };

  // Scrolls the just-added widget into view once its DOM node exists --
  // deferred a tick past the state update above (ref won't be attached
  // until the following render commits).
  useEffect(() => {
    if (!pendingScrollTo) return;
    const el = document.getElementById(`widget-tile-${pendingScrollTo}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('widget-just-added');
      setTimeout(() => el.classList.remove('widget-just-added'), 1600);
    }
    setPendingScrollTo(null);
  }, [pendingScrollTo, widgets]);

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
  const rglLayout: RGLLayout = useMemo(() => widgets.map((w) => {
    const l = layoutById.get(w.instanceId);
    if (l) return l;
    const def = registryMap.get(w.widgetId);
    return { i: w.instanceId, x: 0, y: 0, w: def?.defaultSize.w ?? 4, h: def?.defaultSize.h ?? 6 };
  }), [widgets, layoutById, registryMap]);
  // Skip rescaling (and the new-array-reference churn that comes with it)
  // entirely at the full desktop width -- `rglLayout` itself stays the
  // single stable reference feeding the grid in the common case.
  const rescaledLayout = useMemo(() => rescaleLayout(rglLayout, COLS, cols), [rglLayout, cols]);
  const displayLayout = cols === COLS ? rglLayout : rescaledLayout;
  const canEdit = editing && isDesktopWidth;

  return (
    <div className="widget-grid-page">
      <div className={`widget-grid-toolbar ${editing ? 'is-editing-toolbar' : ''}`}>
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
          layout={displayLayout}
          cols={cols}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={[0, 0]}
          isDraggable={canEdit}
          isResizable={canEdit}
          draggableCancel=".widget-remove-btn, .widget-card-title-link, a, button, input, select, textarea"
          resizeHandles={['se']}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms
          onLayoutChange={handleLayoutChange}
        >
          {widgets.map((w, i) => {
            const def = registryMap.get(w.widgetId);
            if (!def) return null;
            const Component = def.Component;
            const Icon = def.icon;
            return (
              <div
                key={w.instanceId}
                id={`widget-tile-${w.instanceId}`}
                className="widget-grid-item"
                style={{ '--stagger-i': i } as CSSProperties}
              >
                <WidgetCard
                  title={def.title}
                  icon={Icon ? <Icon size={16} className="widget-card-icon" /> : undefined}
                  editing={canEdit}
                  chromeless={def.chromeless}
                  titleHref={def.titleLink}
                  onRemove={() => removeWidget(w.instanceId)}
                >
                  <WidgetErrorBoundary widgetTitle={def.title}>
                    <Component instanceId={w.instanceId} />
                  </WidgetErrorBoundary>
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
