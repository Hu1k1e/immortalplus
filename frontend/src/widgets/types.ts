import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export type WidgetCategory = 'overview' | 'trends' | 'matches' | 'heroes' | 'meta' | 'spotlight' | 'coach';

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  overview: 'Overview Stats',
  trends: 'Trend Graphs',
  matches: 'Matches & Columns',
  heroes: 'Heroes',
  meta: 'Meta',
  spotlight: 'Spotlight Cards',
  coach: 'Personal AI Coach (Future)',
};

export interface WidgetSize {
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetDefinition {
  /** Stable id for this widget *type* -- referenced by placed instances. */
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  icon?: LucideIcon;
  Component: ComponentType<{ instanceId: string }>;
  /** Render without the standard title-bar chrome (widget draws its own header). */
  chromeless?: boolean;
  /** Only one instance of this widget may exist on the board at a time. */
  singleton?: boolean;
}

export interface WidgetInstance {
  instanceId: string;
  widgetId: string;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}
