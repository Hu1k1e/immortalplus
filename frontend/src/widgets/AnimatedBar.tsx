import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/** A bar-fill <div> whose width animates in from 0 to its target percentage
 * on mount/whenever the target changes, instead of snapping straight to
 * its final value -- used for the entrance-animation pass across widgets
 * with progress/percentage bars (performance score, hero pick share,
 * lane record, etc). */
export function AnimatedBar({ pct, className, style }: { pct: number; className?: string; style?: CSSProperties }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    setWidth(0);
    const raf = requestAnimationFrame(() => setWidth(Math.max(0, Math.min(100, pct))));
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  return (
    <div
      className={className}
      style={{ ...style, width: `${width}%`, transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)' }}
    />
  );
}
