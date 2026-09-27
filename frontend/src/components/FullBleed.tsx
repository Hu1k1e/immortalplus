import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Breaks its children out of the page's centered, max-width content
 * container (`.content-container`, capped at 1400px and centered with
 * `margin: 0 auto` inside `.main-content`) to fill the rest of the
 * viewport's width instead — used for the Playback page, which needs the
 * full available width for a large map + two team columns.
 *
 * A plain width calc isn't enough here: `.content-container` is itself
 * centered, so its child sits inset from `.main-content`'s true left edge
 * by however much empty margin the centering leaves on that side — a
 * width-only fix still starts from that inset position, leaving a visible
 * gap (the bug this component originally shipped with). Instead this
 * measures `.main-content`'s real bounding box and sets negative margins
 * to pull this element's edges out to match it exactly, however much
 * inset the parent's centering/padding currently happens to be.
 */
export default function FullBleed({ children }: { children: React.ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    const measure = () => {
      const el = anchorRef.current;
      const container = el?.closest('.main-content') as HTMLElement | null;
      if (!el || !container) return;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const padLeft = parseFloat(containerStyle.paddingLeft) || 0;
      const padRight = parseFloat(containerStyle.paddingRight) || 0;
      const targetLeft = containerRect.left + padLeft;
      const targetRight = containerRect.right - padRight;
      setStyle({
        marginLeft: `${targetLeft - elRect.left}px`,
        marginRight: `${elRect.right - targetRight}px`,
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
