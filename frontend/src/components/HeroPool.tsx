import { getHeroIcon } from '../lib/dota';
import { HEROES } from '../lib/heroes';

interface HeroPoolProps {
  usedHeroIds: Set<number>;
  search: string;
  onSearchChange: (value: string) => void;
  onDragStart: (heroId: number) => void;
  onHeroClick: (heroId: number) => void;
  selectedSlotActive: boolean;
}

/**
 * The full hero roster for the Manual Draft tab — every hero, searchable,
 * draggable onto a team slot, or click-to-place into whichever slot is
 * currently selected (see DraftHelper's selectedSlot state). A hero
 * already placed on either team is shown dimmed and disabled rather than
 * removed from the grid entirely — Dota doesn't allow the same hero on
 * both sides or twice on one side, and keeping it visible (just inert)
 * makes that constraint obvious instead of heroes mysteriously vanishing.
 */
export default function HeroPool({
  usedHeroIds,
  search,
  onSearchChange,
  onDragStart,
  onHeroClick,
  selectedSlotActive,
}: HeroPoolProps) {
  const query = search.trim().toLowerCase();
  const heroes = Object.values(HEROES)
    .filter((h: any) => !query || h.name.toLowerCase().includes(query))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <div className="hero-pool glass-surface">
      <div className="hero-pool-search-row">
        <input
          type="text"
          className="hero-pool-search"
          placeholder="Search heroes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {selectedSlotActive && (
          <span className="hero-pool-hint">Click a hero to fill the selected slot</span>
        )}
      </div>
      <div className="hero-pool-grid">
        {heroes.map((h: any) => {
          const used = usedHeroIds.has(h.id);
          return (
            <div
              key={h.id}
              className={`hero-pool-item ${used ? 'used' : ''}`}
              draggable={!used}
              onDragStart={(e) => {
                if (used) { e.preventDefault(); return; }
                onDragStart(h.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => { if (!used) onHeroClick(h.id); }}
              title={h.name}
            >
              <img src={getHeroIcon(h.id)} alt={h.name} />
              <span className="hero-pool-item-name">{h.name}</span>
            </div>
          );
        })}
        {heroes.length === 0 && <p className="text-muted">No heroes match "{search}".</p>}
      </div>
    </div>
  );
}
