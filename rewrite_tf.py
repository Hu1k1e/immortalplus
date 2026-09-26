import sys

new_content = """// ================ TEAMFIGHTS TAB ================
export function TeamfightsTab({ teamfights, allPlayers }: { teamfights: any[]; allPlayers: any[] }) {
  const [selectedTf, setSelectedTf] = useState<number>(0);
  const [hoveredTf, setHoveredTf] = useState<number | null>(null);

  const parsedTeamfights = useMemo(() => {
    if (!teamfights) return [];
    return teamfights.map((tf) => {
      let radiant_gold_advantage_delta = 0;
      let deaths_pos: any[] = [];
      const tfPlayers = allPlayers.map((player, idx) => {
        const tfplayer = tf.players[idx];
        if (!tfplayer) return null;
        const isRadiant = player.player_slot < 128;
        if (isRadiant) {
          radiant_gold_advantage_delta += (tfplayer.gold_delta || 0);
        } else {
          radiant_gold_advantage_delta -= (tfplayer.gold_delta || 0);
        }
        
        if (tfplayer.deaths_pos) {
          Object.keys(tfplayer.deaths_pos).forEach(k => {
             const [x,y] = k.split(",").map(Number);
             for(let i=0; i<tfplayer.deaths_pos[k]; i++){
               deaths_pos.push({ x, y, isRadiant, player });
             }
          });
        }
        return { ...player, ...tfplayer };
      });

      const final_deaths_pos = deaths_pos.map((death: any) => {
        const heroName = HEROES[death.player.hero_id as keyof typeof HEROES]?.img_name;
        const deathHeroName = "npc_dota_hero_" + heroName;
        const killer = tfPlayers.find(k => k && k.killed && k.killed[deathHeroName]);
        return { ...death, killer };
      });

      return {
        ...tf,
        players: tfPlayers,
        radiant_gold_advantage_delta,
        deaths_pos: final_deaths_pos
      };
    });
  }, [teamfights, allPlayers]);

  if (!parsedTeamfights?.length) return <div style={{ padding: "2rem", color: "var(--text-muted)" }}>No teamfight data available.</div>;

  const tf = parsedTeamfights[selectedTf] || parsedTeamfights[0];
  if (!tf) return null;

  const maxDamage = Math.max(...tf.players.map((p: any) => p?.damage || 0));
  const maxHealing = Math.max(...tf.players.map((p: any) => p?.healing || 0));
  const maxGold = Math.max(...tf.players.map((p: any) => Math.abs(p?.gold_delta || 0)));
  const maxXp = Math.max(...tf.players.map((p: any) => Math.abs(p?.xp_delta || 0)));

  const formatTime = (t: number) => {
    const neg = t < 0;
    const abs = Math.abs(t);
    return `${neg ? "-" : ""}${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, "0")}`;
  };

  const renderAbilityGrid = (uses: any) => {
    if (!uses || Object.keys(uses).length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "140px" }}>
        {Object.entries(uses).map(([k, v]: any) => (
          <div key={k} style={{ position: "relative" }}>
            <img src={getAbilityImage(k)} style={{ width: "28px", height: "28px", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <span style={{ position: "absolute", bottom: 0, right: 0, fontSize: "0.7rem", background: "rgba(0,0,0,0.8)", padding: "0 3px", lineHeight: 1 }}>{v}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderItemGrid = (uses: any) => {
    if (!uses || Object.keys(uses).length === 0) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "140px" }}>
        {Object.entries(uses).map(([k, v]: any) => (
          <div key={k} style={{ position: "relative" }}>
            <img src={getItemImage(k.replace("item_", ""))} style={{ width: "38px", height: "28px", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <span style={{ position: "absolute", bottom: 0, right: 0, fontSize: "0.7rem", background: "rgba(0,0,0,0.8)", padding: "0 3px", lineHeight: 1 }}>{v}</span>
          </div>
        ))}
      </div>
    );
  };

  const cols = [
    { key: "death", label: "DEATH", render: (p: any) => p.deaths > 0 ? <span style={{ color: "var(--dire-red)", fontSize: "1.2rem", textShadow: "0 0 5px rgba(255,0,0,0.5)" }}>💀</span> : "" },
    { key: "damage", label: "DAMAGE", sortFn: (a: any, b: any) => (a.damage || 0) - (b.damage || 0), render: (p: any) => p.damage ? <PercentBar value={p.damage} max={maxDamage} color="var(--accent-gold)" /> : "-" },
    { key: "healing", label: "HEALING", sortFn: (a: any, b: any) => (a.healing || 0) - (b.healing || 0), render: (p: any) => p.healing ? <PercentBar value={p.healing} max={maxHealing} color="var(--radiant-green)" /> : "-" },
    { key: "gold_delta", label: "G", sortFn: (a: any, b: any) => (a.gold_delta || 0) - (b.gold_delta || 0), render: (p: any) => p.gold_delta ? <PercentBar value={p.gold_delta} max={maxGold} color="#ffb300" /> : "-" },
    { key: "xp_delta", label: "XP", sortFn: (a: any, b: any) => (a.xp_delta || 0) - (b.xp_delta || 0), render: (p: any) => p.xp_delta ? <PercentBar value={p.xp_delta} max={maxXp} color="#42a5f5" /> : "-" },
    { key: "abilities", label: "ABILITIES", render: (p: any) => renderAbilityGrid(p.ability_uses) },
    { key: "items", label: "ITEMS", render: (p: any) => renderItemGrid(p.item_uses) }
  ];

  const matchDuration = Math.max(...parsedTeamfights.map((t: any) => t.end || 0));

  return (
    <div className="animation-fade-in" style={{ padding: "1rem 0" }}>
      
      {/* TIMELINE */}
      <div style={{ position: "relative", width: "100%", height: "80px", marginBottom: "2rem", display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: "60px", top: "50%", width: "calc(100% - 120px)", height: "2px", background: "rgba(255,255,255,0.2)" }} />
        
        <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <div>Radiant</div>
          <div style={{ margin: "5px 0" }} />
          <div>Dire</div>
        </div>
        
        <div style={{ position: "absolute", left: "60px", top: "calc(50% + 15px)", fontSize: "0.8rem", color: "var(--text-muted)" }}>0:00</div>
        <div style={{ position: "absolute", right: "60px", top: "calc(50% - 7px)", fontSize: "0.8rem", color: "var(--text-muted)", background: "var(--bg-color)", padding: "0 5px" }}>{formatTime(matchDuration)}</div>

        {parsedTeamfights.map((t: any, i: number) => {
          const left = 60 + ((t.start / matchDuration) * 100); 
          const isSelected = selectedTf === i;
          const isHovered = hoveredTf === i;
          const isRadiantWon = t.radiant_gold_advantage_delta > 0;
          const color = isRadiantWon ? "var(--radiant-green)" : "var(--dire-red)";
          
          return (
            <div 
              key={i} 
              onMouseEnter={() => setHoveredTf(i)}
              onMouseLeave={() => setHoveredTf(null)}
              onClick={() => setSelectedTf(i)}
              style={{
                position: "absolute", 
                left: `calc(60px + (100% - 120px) * ${t.start / matchDuration})`, 
                top: "50%",
                transform: "translate(-50%, -50%)",
                cursor: "pointer",
                zIndex: isSelected || isHovered ? 10 : 1
              }}
            >
              <div style={{
                color: color,
                fontSize: isSelected || isHovered ? "24px" : "16px",
                fontWeight: "bold",
                transition: "all 0.2s",
                textShadow: isSelected ? `0 0 10px ${color}` : "none"
              }}>
                ✖
              </div>

              {/* TIMELINE TOOLTIP */}
              {isHovered && (
                <div className="glass-surface" style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  marginTop: "10px",
                  padding: "10px",
                  minWidth: "220px",
                  zIndex: 20,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                  pointerEvents: "none"
                }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "4px" }}>
                    Deaths & gold delta, {formatTime(t.start)} - {formatTime(t.end)}
                  </div>
                  {t.players.filter((p:any) => p).sort((a:any, b:any) => a.player_slot - b.player_slot).map((p:any) => (
                    <div key={p.account_id || p.hero_id || Math.random()} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontSize: "0.85rem" }}>
                      <img src={getHeroImage(HEROES[p.hero_id as keyof typeof HEROES]?.img_name || "")} style={{ width: "24px", height: "14px", objectFit: "cover" }} />
                      <span style={{ color: p.player_slot < 128 ? "var(--radiant-green)" : "var(--dire-red)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.persona || p.name || HEROES[p.hero_id as keyof typeof HEROES]?.name || "Unknown"}</span>
                      {p.deaths > 0 && <span style={{ color: "var(--dire-red)" }}>💀</span>}
                      <span style={{ color: p.gold_delta > 0 ? "var(--radiant-green)" : "var(--dire-red)", minWidth: "40px", textAlign: "right" }}>
                        {p.gold_delta > 0 ? "▲" : "▼"} {Math.abs(p.gold_delta || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "2rem" }}>
        {/* MAP & SUMMARY */}
        <div style={{ flex: "0 0 350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ position: "relative", width: "350px", height: "350px", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border-color)", background: "#222" }}>
            <img src="/assets/images/dota2/Game_map_7.41.jpg" alt="Map" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {tf.deaths_pos.map((m: any, i: number) => {
               const px = Math.min(100, Math.max(0, ((m.x - 64) / 128) * 100));
               const py = Math.min(100, Math.max(0, (1 - ((m.y - 64) / 128)) * 100));
               return (
                 <div key={i} className="map-icon-hover" style={{
                   position: "absolute", left: `${px}%`, top: `${py}%`,
                   width: "18px", height: "18px", background: m.isRadiant ? "var(--radiant-green)" : "var(--dire-red)", borderRadius: "50%",
                   transform: "translate(-50%, -50%)", border: "2px solid #000",
                   display: "flex", alignItems: "center", justifyContent: "center",
                   cursor: "pointer"
                 }}>
                   <span style={{ fontSize: "10px" }}>💀</span>
                   <div className="map-tooltip glass-surface" style={{ minWidth: "200px", display: "flex", alignItems: "center", gap: "10px" }}>
                     <PlayerCell player={m.player} />
                     <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>killed by</div>
                     {m.killer ? <PlayerCell player={m.killer} /> : <span style={{ color: "var(--text-muted)" }}>Unknown</span>}
                   </div>
                 </div>
               );
            })}
          </div>
          
          <div style={{ textAlign: "center" }}>
            <h3 style={{ color: "var(--accent-gold)", marginBottom: "0.5rem", fontSize: "1.2rem" }}>{formatTime(tf.start)} - {formatTime(tf.end)}</h3>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "1rem" }}>
              <img src={tf.radiant_gold_advantage_delta > 0 ? "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/radiant.png" : "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/dire.png"} style={{ width: "24px" }} />
              <span style={{ fontSize: "1.5rem", color: "var(--accent-gold)", fontWeight: "bold" }}>{Math.abs(tf.radiant_gold_advantage_delta)} <span style={{ fontSize: "1rem" }}>🪙</span></span>
            </div>
          </div>
        </div>

        {/* TABLES */}
        <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "2rem" }}>
          <TeamTable 
            title="Radiant - Teamfights" 
            players={tf.players.filter((p:any) => p && p.player_slot < 128)}
            columns={cols}
            noOverflow
          />
          <TeamTable 
            title="Dire - Teamfights" 
            players={tf.players.filter((p:any) => p && p.player_slot >= 128)}
            columns={cols}
            noOverflow
          />
        </div>
      </div>
    </div>
  );
}
"""

with open("c:/Users/svija/.gemini/antigravity/scratch/Dota 2 Coach Immortal+/frontend/src/components/MatchTabs.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "export function TeamfightsTab" in line:
        start_idx = i
        break
for i in range(start_idx, len(lines)):
    if "export function ChatTab" in lines[i] or "export function StoryTab" in lines[i] or "export function LogTab" in lines[i] or "export function CosmeticsTab" in lines[i] or "export function FantasyTab" in lines[i]:
        end_idx = i
        break
new_lines = lines[:start_idx] + [new_content + "\n"] + lines[end_idx:]
with open("c:/Users/svija/.gemini/antigravity/scratch/Dota 2 Coach Immortal+/frontend/src/components/MatchTabs.tsx", "w", encoding="utf-8") as f:
    f.writelines(new_lines)
