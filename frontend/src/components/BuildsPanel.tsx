import { useState, Fragment } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage, getAbilityImage, ITEMS } from '../lib/dota';
import { getPlayerPosition, POSITION_INFO } from '../lib/roles';
import { getAbilityBuildOrder, getSkillBuildLabel, getTalentTree } from '../lib/talents';
import PositionIcon from './PositionIcon';

/**
 * Only the "main" items Stratz's own build display shows — not every raw
 * purchase. Two real signals from items.json, not a guess: drop anything
 * qual==="consumable" (tangos/clarity/wards/etc, never a build piece), and
 * drop any item that a LATER purchase's `components` list names (it got
 * combined into something bigger, e.g. Circlet -> Wraith Band) — an item
 * only counts as "main" if it's still standing at the end of its own
 * upgrade chain, or was never a component of anything the player bought
 * afterward.
 */
function purchaseLogOf(p: any) {
  let log = p.purchase_log;
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { log = []; }
  }
  if (!Array.isArray(log)) return [];
  const raw = log.filter((e: any) => e.key && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser');

  const consumedKeys = new Set<string>();
  raw.forEach((e: any) => {
    const components: string[] | null = ITEMS[e.key]?.components || null;
    if (components) components.forEach((c) => consumedKeys.add(c));
  });

  return raw.filter((e: any) => {
    const item = ITEMS[e.key];
    if (item?.qual === 'consumable') return false;
    if (consumedKeys.has(e.key)) return false;
    return true;
  });
}

function formatClock(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WardIcon({ type, size = 18 }: { type: 'obs' | 'sen'; size?: number }) {
  const key = type === 'obs' ? 'ward_observer' : 'ward_sentry';
  return (
    <img
      src={getItemImage(key)}
      alt={type === 'obs' ? 'Observer Ward' : 'Sentry Ward'}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

/** Single talent-tree badge, top-right of the card. Hovering shows the same
 * layout the game's own talent tree uses: two columns of options (tier 25
 * at the top down to tier 10 at the bottom, matching the in-game tree's
 * visual order) with the tree icon centered between them, chosen option
 * gold/bold, the other dimmed. */
function TalentBadge({ heroNpcName, abilityUpgradesArr, anchor }: { heroNpcName?: string; abilityUpgradesArr?: number[]; anchor: 'left' | 'right' }) {
  const [hovered, setHovered] = useState(false);
  const tiers = getTalentTree(heroNpcName, abilityUpgradesArr);
  if (tiers.length === 0 || !tiers.some((t) => t.options.length > 0)) return null;
  const reversed = [...tiers].reverse();

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src="/assets/images/dota2/talent_tree.svg"
        alt="Talents"
        style={{ width: '22px', height: '22px', flexShrink: 0, cursor: 'default', filter: 'drop-shadow(0 0 4px rgba(226,183,66,0.6))' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {hovered && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: '4px', zIndex: 40, width: '270px',
          ...(anchor === 'left' ? { left: 0 } : { right: 0 }),
          background: 'rgba(15,17,21,0.98)', border: '1px solid var(--border-color)', borderRadius: '4px',
          padding: '0.5rem 0.6rem', fontSize: '0.66rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', rowGap: '0.2rem', alignItems: 'center' }}>
            <img
              src="/assets/images/dota2/talent_tree.svg" alt=""
              style={{
                gridColumn: 2, gridRow: `1 / span ${reversed.length}`, width: '22px', height: '22px', margin: '0 0.4rem',
                filter: 'drop-shadow(0 0 5px rgba(226,183,66,0.85))',
              }}
            />
            {reversed.map((tier, row) => (
              <Fragment key={tier.level}>
                <span style={{
                  gridColumn: 1, gridRow: row + 1, textAlign: 'right', lineHeight: 1.25,
                  color: tier.options[0]?.chosen ? 'var(--accent-gold)' : 'var(--text-muted)',
                  fontWeight: tier.options[0]?.chosen ? 700 : 400,
                  textShadow: tier.options[0]?.chosen ? '0 0 6px rgba(226,183,66,0.8)' : 'none',
                }}>
                  {tier.options[0]?.label}
                </span>
                <span style={{
                  gridColumn: 3, gridRow: row + 1, textAlign: 'left', lineHeight: 1.25,
                  color: tier.options[1]?.chosen ? 'var(--accent-gold)' : 'var(--text-muted)',
                  fontWeight: tier.options[1]?.chosen ? 700 : 400,
                  textShadow: tier.options[1]?.chosen ? '0 0 6px rgba(226,183,66,0.8)' : 'none',
                }}>
                  {tier.options[1]?.label}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroBuildBox({ player, scrubTime, onClick }: { player: any; scrubTime: number; onClick?: () => void }) {
  const hero = HEROES[player.hero_id];
  const isRadiant = player.player_slot < 128;
  const log = purchaseLogOf(player);
  // HEROES here is the legacy hardcoded map (`.name` is the display name,
  // e.g. "Sven") — hero_abilities.json is keyed by the real npc name, so
  // it has to be rebuilt from img_name instead of read off hero.name.
  const heroNpcName = hero ? `npc_dota_hero_${hero.img_name}` : undefined;
  const skillBuild = getSkillBuildLabel(heroNpcName, player.ability_upgrades_arr);
  const abilityOrder = getAbilityBuildOrder(heroNpcName, player.ability_upgrades_arr).filter((a) => !a.isTalent);
  const obsCount = player.purchase_ward_observer || 0;
  const senCount = player.purchase_ward_sentry || 0;

  return (
    <div className="glass-surface card-interactive" style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '42px', height: '42px', objectFit: 'cover', objectPosition: 'center 30%', borderRadius: '4px', flexShrink: 0 }} />}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.persona || player.personaname || 'Anonymous'}
          </div>
          {skillBuild && <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{skillBuild} build</div>}
        </div>

        <TalentBadge heroNpcName={heroNpcName} abilityUpgradesArr={player.ability_upgrades_arr} anchor={isRadiant ? 'left' : 'right'} />
      </div>

      {abilityOrder.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '0.5rem' }}>
          {abilityOrder.map((a, i) => (
            <img
              key={i}
              src={getAbilityImage(a.name)}
              alt={a.label}
              title={a.label}
              style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
      )}

      {log.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.55rem' }}>No item timing data.</div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.55rem' }}>
          {log.map((entry: any, i: number) => {
            const taken = (entry.time || 0) <= scrubTime;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src={getItemImage(entry.key)}
                  alt={entry.key}
                  title={`${entry.key.replace(/_/g, ' ')} @ ${formatClock(entry.time || 0)}`}
                  style={{
                    width: '38px', height: '27px', objectFit: 'cover', borderRadius: '3px',
                    filter: taken ? 'none' : 'grayscale(100%) brightness(0.45)',
                    opacity: taken ? 1 : 0.55,
                    transition: 'filter 0.15s, opacity 0.15s',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span style={{ fontSize: '0.6rem', color: taken ? 'var(--text-muted)' : 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                  {formatClock(entry.time || 0)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.9rem', marginTop: '0.55rem' }}>
        <span title="Observer wards purchased" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <WardIcon type="obs" /> {obsCount}
        </span>
        <span title="Sentry wards purchased" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <WardIcon type="sen" /> {senCount}
        </span>
      </div>
    </div>
  );
}

/**
 * Full-width Builds panel: each of the 10 players gets their own box
 * (portrait, item purchase timeline, talent tree, ward counts), split into
 * Radiant/Dire columns and vertically ordered by position (1 Carry ... 5
 * Hard Support) with a center strip of position icons connecting matching
 * rows across both sides — matching stratz.com's layout. A scrub bar
 * stickied to the bottom of the panel grays out any item not yet purchased
 * as of that time; talents aren't scrub-reactive since no data source
 * available to this app timestamps individual talent picks (only the flat
 * ability_upgrades_arr order, unlike purchase_log's real timestamps).
 */
export default function BuildsPanel({ matchData, allPlayers, currentTime, onSelectPlayer }: { matchData: any; allPlayers: any[]; currentTime?: number; onSelectPlayer?: (p: any) => void }) {
  const maxPurchaseTime = Math.max(0, ...allPlayers.flatMap((p) => purchaseLogOf(p).map((e: any) => e.time || 0)));
  const duration = matchData?.duration || maxPurchaseTime || 1;
  // Driven by the page's shared playback clock when given (the global
  // sticky bar at the bottom of Overview); falls back to its own local
  // scrubber so this panel still works when rendered standalone.
  const [localScrubTime, setLocalScrubTime] = useState(duration);
  const scrubTime = currentTime != null ? currentTime : localScrubTime;

  const radiant = allPlayers.filter((p) => p.player_slot < 128);
  const dire = allPlayers.filter((p) => p.player_slot >= 128);
  const byPosition = (players: any[]) => [...players].sort((a, b) => (getPlayerPosition(a, players) ?? 9) - (getPlayerPosition(b, players) ?? 9));
  const radiantSorted = byPosition(radiant);
  const direSorted = byPosition(dire);

  const hasAny = allPlayers.some((p) => purchaseLogOf(p).length > 0);

  return (
    <div className="glass-surface" style={{ padding: '1rem', marginTop: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Builds</h3>
      {!hasAny ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Item timing data not available.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: '0.6rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {radiantSorted.map((p) => <HeroBuildBox key={p.player_slot} player={p} scrubTime={scrubTime} onClick={onSelectPlayer ? () => onSelectPlayer(p) : undefined} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map((pos) => (
                <div key={pos} title={POSITION_INFO[pos].label}>
                  <PositionIcon short={POSITION_INFO[pos].short} size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {direSorted.map((p) => <HeroBuildBox key={p.player_slot} player={p} scrubTime={scrubTime} onClick={onSelectPlayer ? () => onSelectPlayer(p) : undefined} />)}
            </div>
          </div>

          {currentTime == null && (
            <div style={{
              position: 'sticky', bottom: 0, marginTop: '1rem', padding: '0.6rem 1rem',
              background: '#0f1115', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 10,
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '85px', flexShrink: 0 }}>
                {formatClock(scrubTime)} / {formatClock(duration)}
              </span>
              <input
                type="range" min={0} max={duration} value={scrubTime}
                onChange={(e) => setLocalScrubTime(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-gold)' }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
