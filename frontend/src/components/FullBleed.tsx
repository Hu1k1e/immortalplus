import { useEffect, useRef, useState } from 'react';

/**
 * Breaks its children out of the page's centered, max-width content
 * container (`.content-container`, capped at 1400px) to fill the rest of
 * the viewport's width instead — used for the Playback page, which needs
 * the full available width for a large map + two team columns. Measures
 * its own offset from the viewport's left edge (sidebar width + container
 * padding) via a ref rather than hardcoding those numbers, so it stays
 * correct if the layout's sidebar width or padding ever changes.
 */
export default function FullBleed({ children }: { children: React.ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const measure = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const rightPadding = 24; // mirrors .content-container's own right padding, roughly
      setStyle({
        width: `calc(100vw - ${rect.left}px - ${rightPadding}px)`,
        marginLeft: 0,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div ref={anchorRef} style={style}>
      {children}
    </div>
  );
}
