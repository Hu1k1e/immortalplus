import { useMemo, useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import type { WidgetDefinition, WidgetCategory } from './types';
import { CATEGORY_LABELS } from './types';
import './AddWidgetPanel.css';

interface AddWidgetPanelProps {
  registry: WidgetDefinition[];
  placedWidgetIds: string[];
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}

const CATEGORY_ORDER: WidgetCategory[] = ['overview', 'trends', 'matches', 'heroes', 'meta', 'spotlight', 'coach'];

export default function AddWidgetPanel({ registry, placedWidgetIds, onAdd, onClose }: AddWidgetPanelProps) {
  const [search, setSearch] = useState('');
  const placedSet = useMemo(() => new Set(placedWidgetIds), [placedWidgetIds]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCategory = new Map<WidgetCategory, WidgetDefinition[]>();
    for (const def of registry) {
      if (q && !def.title.toLowerCase().includes(q) && !def.description.toLowerCase().includes(q)) continue;
      const list = byCategory.get(def.category) ?? [];
      list.push(def);
      byCategory.set(def.category, list);
    }
    return CATEGORY_ORDER
      .map((cat) => ({ cat, items: byCategory.get(cat) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [registry, search]);

  return (
    <div className="add-widget-overlay" onClick={onClose}>
      <div className="add-widget-panel glass-surface" onClick={(e) => e.stopPropagation()}>
        <div className="add-widget-panel-header">
          <h3>Add a Widget</h3>
          <button type="button" className="add-widget-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="add-widget-search">
          <Search size={14} />
          <input
            autoFocus
            placeholder="Search widgets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="add-widget-list">
          {grouped.length === 0 && <div className="add-widget-empty">No widgets match "{search}".</div>}
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="add-widget-group">
              <div className="add-widget-group-title">{CATEGORY_LABELS[cat]}</div>
              {items.map((def) => {
                const isPlaced = def.singleton && placedSet.has(def.id);
                return (
                  <button
                    type="button"
                    key={def.id}
                    className="add-widget-item"
                    disabled={isPlaced}
                    onClick={() => !isPlaced && onAdd(def.id)}
                  >
                    <div className="add-widget-item-text">
                      <div className="add-widget-item-title">{def.title}</div>
                      <div className="add-widget-item-desc">{def.description}</div>
                    </div>
                    <span className="add-widget-item-plus">
                      {isPlaced ? 'Added' : <Plus size={15} />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
