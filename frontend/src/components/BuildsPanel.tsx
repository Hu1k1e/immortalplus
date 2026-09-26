import { useState } from 'react';
import { HEROES } from '../lib/heroes';
import { getHeroImage, getItemImage, getAbilityImage } from '../lib/dota';
import { getPlayerPosition, POSITION_INFO } from '../lib/roles';
import { getAbilityBuildOrder, getSkillBuildLabel } from '../lib/talents';
import PositionIcon from './PositionIcon';

function purchaseLogOf(p: any) {
  let log = p.purchase_log;
  if (typeof log === 'string') {
    try { log = JSON.parse(log); } catch { log = []; }
  }
  return Array.isArray(log) ? log.filter((e: any) => e.key && !e.key.startsWith('recipe_') && e.key !== 'ward_dispenser') : [];
}

function formatClock(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WardIcon({ type }: { type: 'obs' | 'sen' }) {
  return type === 'obs' ? (
    <svg width="10" height="10" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#4da6ff" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="3" fill="#4da6ff" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M12 2 L22 8 V16 L12 22 L2 16 V8 Z" fill="none" stroke="#e2b742" strokeWidth="2.5" />
    </svg>
  );
}

function HeroBuildBox({ player, scrubTime }: { player: any; scrubTime: number }) {
  const hero = HEROES[player.hero_id];
  const log = purchaseLogOf(player);
  // HEROES here is the legacy hardcoded map (`.name` is the display name,
  // e.g. "Sven") — hero_abilities.json is keyed by the real npc name, so
  // it has to be rebuilt from img_name instead of read off hero.name.
  const heroNpcName = hero ? `npc_dota_hero_${hero.img_name}` : undefined;
  const skillBuild = getSkillBuildLabel(heroNpcName, player.ability_upgrades_arr);
  const abilityOrder = getAbilityBuildOrder(heroNpcName, player.ability_upgrades_arr);
  const obsCount = player.purchase_ward_observer || 0;
  const senCount = player.purchase_ward_sentry || 0;

  return (
    <div className="glass-surface" style={{ padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {hero && <img src={getHeroImage(hero.img_name)} alt={hero.name} style={{ width: '36px', height: '36px', objectFit: 'cover', objectPosition: 'center 30%', borderRadius: '4px', flexShrink: 0 }} />}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.persona || player.personaname || 'Anonymous'}
          </div>
          {skillBuild && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{skillBuild} build</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          <span title="Observer wards purchased" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <WardIcon type="obs" /> {obsCount}
          </span>
          <span title="Sentry wards purchased" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <WardIcon type="sen" /> {senCount}
          </span>
        </div>
      </div>

      {abilityOrder.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.4rem' }}>
          {abilityOrder.map((a, i) => (
            <img
              key={i}
              src={getAbilityImage(a.name)}
              alt={a.label}
              title={a.label}
              style={{
                width: '15px', height: '15px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0,
                border: a.isTalent ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
      )}

      {log.length === 0 ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>No item timing data.</div>
      ) : (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {log.map((entry: any, i: number) => {
            const taken = (entry.time || 0) <= scrubTime;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src={getItemImage(entry.key)}
                  alt={entry.key}
                  title={`${entry.key.replace(/_/g, ' ')} @ ${formatClock(entry.time || 0)}`}
                  style={{
                    width: '27px', height: '19px', objectFit: 'cover', borderRadius: '3px',
                    filter: taken ? 'none' : 'grayscale(100%) brightness(0.45)',
                    opacity: taken ? 1 : 0.55,
                    transition: 'filter 0.15s, opacity 0.15s',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span style={{ fontSize: '0.55rem', color: taken ? 'var(--text-muted)' : 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                  {formatClock(entry.time || 0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
export default function BuildsPanel({ matchData, allPlayers }: { matchData: any; allPlayers: any[] }) {
  const maxPurchaseTime = Math.max(0, ...allPlayers.flatMap((p) => purchaseLogOf(p).map((e: any) => e.time || 0)));
  const duration = matchData?.duration || maxPurchaseTime || 1;
  const [scrubTime, setScrubTime] = useState(duration);

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
              {radiantSorted.map((p) => <HeroBuildBox key={p.player_slot} player={p} scrubTime={scrubTime} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map((pos) => (
                <div key={pos} title={POSITION_INFO[pos].label}>
                  <PositionIcon short={POSITION_INFO[pos].short} size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {direSorted.map((p) => <HeroBuildBox key={p.player_slot} player={p} scrubTime={scrubTime} />)}
            </div>
          </div>

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
              onChange={(e) => setScrubTime(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent-gold)' }}
            />
          </div>
        </>
      )}
    </div>
  );
}
