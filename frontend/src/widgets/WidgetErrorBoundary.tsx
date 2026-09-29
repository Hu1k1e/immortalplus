import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  widgetTitle: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Wraps a single widget's rendered content. A bug in one widget (bad data
 * shape, a null-pointer, whatever) throws during render and would otherwise
 * unmount the whole dashboard -- React tears down everything below the
 * nearest boundary, and this app had none. This confines the blast radius
 * to just that one tile.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`Widget "${this.props.widgetTitle}" crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="widget-error-fallback">
          <AlertTriangle size={20} />
          <span>This widget hit an error and couldn't load.</span>
        </div>
      );
    }
    return this.props.children;
  }
}
