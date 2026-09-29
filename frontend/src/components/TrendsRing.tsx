import { useRef, useState } from 'react';
import PositionIcon from './PositionIcon';

// Muted, desaturated tones (matched to the reference design) rather than
// this app's usual saturated gold/green/red accent palette — the ring is a
// dense multi-segment chart, so it reads better toned down.
export const POSITION_COLORS: Record<number, string> = {
  1: '#c9a24b',
  2: '#5b8fa8',
  3: '#a85c4b',
  4: '#6a9b6e',
  5: '#8a6fa0',
};
export const POSITION_SHORT: Record<number, string> = { 1: 'CARRY', 2: 'MID', 3: 'OFF', 4: 'SOFT4', 5: 'HARD5' };

const HERO_RING_COLORS = ['#c9a24b', '#5b8fa8', '#8a6fa0', '#a85c4b', '#6a9b6e', '#b98aa5', '#7d9bb0', '#a98f6b', '#6f8a63', '#9c7a9e', '#5f7d94', '#b07a5a'];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export type HeroSeg = { hero_id: number; hero_name: string; hero_icon: string; count: number; wins: number; winrate: number; match_id: number | null; positions: { position: number; position_name: string; count: number }[] };
export type PosSeg = { position: number; position_name: string; count: number; wins: number; winrate: number };
type RingTooltip = { kind: 'hero'; data: HeroSeg } | { kind: 'position'; data: PosSeg };

export function TrendsRing({
  heroes, positions, onHeroClick, size = 240,
}: {
  heroes: HeroSeg[];
  positions: PosSeg[];
  onHeroClick: (matchId: number) => void;
  size?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ info: RingTooltip; x: number; y: number } | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 20;
  const outerWidth = 26;
  const gap = 16;
  const innerR = outerR - outerWidth / 2 - gap - 12;
  const innerWidth = 24;

  const heroTotal = heroes.reduce((s, h) => s + h.count, 0);
  const outerCirc = 2 * Math.PI * outerR;
  let outerOffset = 0;
  const heroSegs = heroes.map((h) => {
    const frac = heroTotal ? h.count / heroTotal : 0;
    const seg = { ...h, frac, dash: frac * outerCirc, offset: outerOffset, midAngle: -90 + (outerOffset / outerCirc) * 360 + (frac * 360) / 2 };
    outerOffset += frac * outerCirc;
    return seg;
  });

  const posTotal = positions.reduce((s, p) => s + p.count, 0);
  const innerCirc = 2 * Math.PI * innerR;
  let innerOffset = 0;
  const posSegs = positions.map((p) => {
    const frac = posTotal ? p.count / posTotal : 0;
    const seg = { ...p, frac, dash: frac * innerCirc, offset: innerOffset };
    innerOffset += frac * innerCirc;
    return seg;
  });

  const iconSize = 22;

  const showTooltip = (e: React.MouseEvent, info: RingTooltip) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ info, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <div className="profile-donut-wrap" ref={wrapRef}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(226,183,66,0.03)" />
            <stop offset="100%" stopColor="rgba(226,183,66,0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={outerR + outerWidth / 2 + 6} fill="url(#ringGlow)" />
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={outerWidth} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={innerWidth} />

        {heroTotal === 0 && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--text-muted)">No data</text>
        )}

        {heroSegs.map((s, i) => (
          <circle
            key={s.hero_id}
            cx={cx} cy={cy} r={outerR}
            fill="none"
            stroke={HERO_RING_COLORS[i % HERO_RING_COLORS.length]}
            strokeOpacity={0.85}
            strokeWidth={outerWidth}
            strokeDasharray={`${s.dash} ${outerCirc - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="profile-ring-segment"
            onMouseEnter={(e) => showTooltip(e, { kind: 'hero', data: s })}
            onMouseMove={(e) => showTooltip(e, { kind: 'hero', data: s })}
            onMouseLeave={hideTooltip}
            onClick={() => s.match_id && onHeroClick(s.match_id)}
          />
        ))}

        {posSegs.map((s) => (
          <circle
            key={s.position}
            cx={cx} cy={cy} r={innerR}
            fill="none"
            stroke={POSITION_COLORS[s.position]}
            strokeOpacity={0.9}
            strokeWidth={innerWidth}
            strokeDasharray={`${s.dash} ${innerCirc - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="profile-ring-segment"
            onMouseEnter={(e) => showTooltip(e, { kind: 'position', data: s })}
            onMouseMove={(e) => showTooltip(e, { kind: 'position', data: s })}
            onMouseLeave={hideTooltip}
          />
        ))}

        {heroSegs.filter((s) => s.frac * 360 >= 12 && s.hero_icon).map((s) => {
          const [x, y] = polarPoint(cx, cy, outerR, s.midAngle);
          return (
            <g
              key={`icon-${s.hero_id}`}
              transform={`translate(${x - iconSize / 2}, ${y - iconSize / 2})`}
              className="profile-ring-hero-icon"
              onMouseEnter={(e) => showTooltip(e, { kind: 'hero', data: s })}
              onMouseMove={(e) => showTooltip(e, { kind: 'hero', data: s })}
              onMouseLeave={hideTooltip}
              onClick={() => s.match_id && onHeroClick(s.match_id)}
            >
              <circle cx={iconSize / 2} cy={iconSize / 2} r={iconSize / 2 + 1.5} fill="var(--bg-base)" />
              <image href={s.hero_icon} width={iconSize} height={iconSize} clipPath="circle(50%)" />
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="profile-ring-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: `translate(${tooltip.x > size / 2 ? '-100%' : '0'}, -50%) translateX(${tooltip.x > size / 2 ? '-14px' : '14px'})`,
          }}
        >
          {tooltip.info.kind === 'hero' ? (
            <>
              <div className="profile-ring-tooltip-header">
                <img src={tooltip.info.data.hero_icon} alt="" />
                <span>{tooltip.info.data.hero_name}</span>
              </div>
              <div className="profile-ring-tooltip-stats">
                <div>
                  <div className="profile-ring-tooltip-label">Record</div>
                  <div>{tooltip.info.data.wins}-{tooltip.info.data.count - tooltip.info.data.wins}</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Winrate</div>
                  <div className={tooltip.info.data.winrate >= 50 ? 'good' : 'bad'}>{tooltip.info.data.winrate}%</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Position</div>
                  <div className="profile-ring-tooltip-positions">
                    {tooltip.info.data.positions.length === 0 && <span>—</span>}
                    {tooltip.info.data.positions.slice(0, 2).map((p) => (
                      <span key={p.position} className="profile-ring-tooltip-pos" title={`${p.position_name}: ${p.count}`}>
                        <PositionIcon short={POSITION_SHORT[p.position]} size={12} color={POSITION_COLORS[p.position]} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="profile-ring-tooltip-header">
                <PositionIcon short={POSITION_SHORT[tooltip.info.data.position]} size={14} color={POSITION_COLORS[tooltip.info.data.position]} />
                <span>{tooltip.info.data.position_name}</span>
              </div>
              <div className="profile-ring-tooltip-stats">
                <div>
                  <div className="profile-ring-tooltip-label">Record</div>
                  <div>{tooltip.info.data.wins}-{tooltip.info.data.count - tooltip.info.data.wins}</div>
                </div>
                <div>
                  <div className="profile-ring-tooltip-label">Winrate</div>
                  <div className={tooltip.info.data.winrate >= 50 ? 'good' : 'bad'}>{tooltip.info.data.winrate}%</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
