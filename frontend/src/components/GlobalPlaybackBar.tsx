import { createPortal } from 'react-dom';

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface GlobalPlaybackBarProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setPlaybackSpeed: (s: number) => void;
}

/**
 * Fixed to the viewport bottom (not just sticky inside the Playback
 * section) so the same clock that drives the embedded map/scoreboard is
 * reachable while scrolling anywhere on the Overview tab — Towers,
 * Advantage graph, Builds, and the Matchup grid's live K/D all read this
 * same currentTime, so scrubbing here updates the whole page at once.
 */
export default function GlobalPlaybackBar({
  duration, currentTime, isPlaying, playbackSpeed, setCurrentTime, setIsPlaying, setPlaybackSpeed,
}: GlobalPlaybackBarProps) {
  // Portalled straight to <body> — an ancestor several levels up
  // (.animate-fade-in's keyframes set a `transform`) turns into a
  // containing block for any position:fixed descendant, which traps a
  // plain in-tree fixed bar partway down the page instead of the actual
  // viewport bottom. The portal sidesteps that ancestry entirely.
  return createPortal(
    <div style={{
      position: 'fixed', bottom: 0, left: '260px', right: 0, zIndex: 100,
      background: 'rgba(12,14,18,0.97)', borderTop: '1px solid var(--border-color)',
      padding: '0.5rem 1.25rem', boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
    }}>
      <input
        type="range" min={0} max={duration} value={currentTime}
        onChange={(e) => { setCurrentTime(Number(e.target.value)); setIsPlaying(false); }}
        style={{ width: '100%', accentColor: 'var(--accent-gold)', height: '4px' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setCurrentTime(Math.max(0, currentTime - 30))}
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          ⏮
        </button>
        <button
          onClick={() => setCurrentTime(Math.min(duration, currentTime + 30))}
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          ⏭
        </button>
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            onClick={() => setPlaybackSpeed(s)}
            style={{
              background: playbackSpeed === s ? 'var(--accent-gold)' : 'transparent',
              color: playbackSpeed === s ? '#000' : 'var(--text-muted)',
              border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold',
            }}
          >
            {s}x
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>,
    document.body
  );
}
