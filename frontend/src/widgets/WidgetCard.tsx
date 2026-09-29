import type { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';
import './WidgetCard.css';

interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  editing: boolean;
  chromeless?: boolean;
  onRemove?: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}

export default function WidgetCard({ title, icon, editing, chromeless, onRemove, headerExtra, children }: WidgetCardProps) {
  if (chromeless) {
    return (
      <div className={`widget-card widget-card-chromeless glass-surface ${editing ? 'is-editing' : ''}`}>
        {editing && (
          <div className="widget-card-edit-overlay">
            <span className="widget-drag-handle" title="Drag to move">
              <GripVertical size={16} />
            </span>
            {onRemove && (
              <button type="button" className="widget-remove-btn" onClick={onRemove} title="Remove widget">
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className="widget-card-body widget-card-body-chromeless">{children}</div>
      </div>
    );
  }

  return (
    <div className={`widget-card glass-surface ${editing ? 'is-editing' : ''}`}>
      <div className="widget-card-header">
        {editing && (
          <span className="widget-drag-handle" title="Drag to move">
            <GripVertical size={16} />
          </span>
        )}
        {icon}
        <span className="widget-card-title">{title}</span>
        {headerExtra && <span className="widget-card-header-extra">{headerExtra}</span>}
        {editing && onRemove && (
          <button type="button" className="widget-remove-btn" onClick={onRemove} title="Remove widget">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="widget-card-body">{children}</div>
    </div>
  );
}
