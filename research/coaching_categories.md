# What we measure: the full list of "things a player might be doing wrong"

## How to use this file

This is a working list. Add rows, remove rows, reword things, argue with my
descriptions — that's the point of it being a plain file you can edit
instead of something locked in code. When you're happy with a category
(or a first batch of them), you can hand this whole file to an agent and
say "build the pipeline for the categories marked Priority: High" — it has
enough detail in it to actually build from, not just talk about.

Each item follows the same shape:

- **What it measures** — in plain English, no jargon.
- **What "doing it wrong" looks like** — a real, concrete example.
- **What data it needs** — using the plain names from the reference list
  below, not raw code names.
- **Do we already have that data, or do we need to build it?**
- **Priority** — High / Medium / Low (my starting guess — change these).
- **Notes** — blank, for you.

---

## The raw ingredients: what a parsed replay actually gives us

Everything below is built out of these building blocks. Plain name on the
left, what it actually is on the right. ("Already have" means our parser
already pulls this out of a replay today — building a new category from
these is just arithmetic, not new replay-reading work. "Would need new
work" means the replay technically has this info but we haven't built the
code to pull it out yet.)

| Plain name | What it is | Have it already? |
|---|---|---|
| Gold-over-time list | How much gold each player had, sampled through the game | Yes |
| Experience-over-time list | Same, but experience | Yes |
| Last-hits-over-time list | Creep kills over time (this is how "farm" gets measured) | Yes |
| Net worth-over-time list | Total value of gold + items, over time | Yes |
| Position-over-time list | Where each hero was on the map, roughly once per second | Yes |
| Kill list | Every kill: who, who died, when, where | Yes |
| Death list | Every death: who, when | Yes |
| Item purchase list | Every item bought, by whom, when | Yes |
| Item purchase list, by minute-of-game (0-10, 10-20, etc) | Same, bucketed for "what did they buy early vs late" | Yes |
| Ward placement list | Every ward placed (both types), by whom, when, where | Yes |
| Ward death list | When and where each ward got destroyed | Would need new work (we have placement, not destruction, yet) |
| Alive/dead status over time | Whether each hero was alive at any given second | Yes |
| HP and Mana over time | Real, second-by-second health and mana (built this session) | Yes |
| Damage dealt to heroes, over time | Real cumulative damage to enemy heroes (built this session) | Yes |
| Healing dealt, over time | Real cumulative healing to allies (built this session) | Yes |
| Damage dealt to towers, over time | Real cumulative tower damage (built this session) | Yes |
| Ability/spell cast list | Every spell cast, by whom, when, on whom/where | Would need new work |
| Buyback usage list | When each player used a buyback | Would need new work (the raw event exists, not wired up yet) |
| Team fight list | Grouped clusters of kills/deaths that form a "fight" | Would need new work (can be built from the kill/death list) |
| Roshan kill list | When Roshan died, who got the item drop | Would need new work |
| Building destruction list | When each tower/barracks fell | Yes (already used for the map/objectives feature) |
| Hero role (carry/mid/offlane/support) | Best-guess position for each player, from lane + farm priority | Yes (already used elsewhere in the app) |
| Rank bracket | Herald through Immortal | Yes |
| Patch version | Which game version the match was played on | Would need to check/add |

---

## A. Laning phase (the first ~10 minutes)

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| A1 | Last hits and denies vs. what's normal for this hero/role/rank | Way below the normal range for no good reason (not explained by a hard lane) | Last-hits list, rank bracket | Yes | High | |
| A2 | Experience gained early vs. normal | Falling behind in levels during laning | Experience list | Yes | High | |
| A3 | How much damage was traded in lane | Taking way more harassment than dealing, without a plan to punish it | Position list + damage list | Partial (damage-to-heroes exists; separating "lane phase only" is just filtering by time) | Medium | |
| A4 | Getting hit by a gank in lane | Dying early to an enemy rotation, especially without a ward nearby | Death list + ward list + position list | Yes | Medium | |
| A7 | What lane setup was used (e.g. three heroes sharing a lane — a "trilane" — vs. the standard one-per-lane split) | Not itself a mistake — this is a *labeling* category, not a right/wrong one. Without it, a real, sometimes-correct strategy that's more common at some ranks than others (see the discussion in `build_plan.md` about not building the book from only top-rank games) gets silently averaged into other stats instead of being recognized as its own real pattern | Position list in the first few minutes (cluster of heroes staying in one lane) | Would need new work (a real, if straightforward, pattern-detection step) | High | Added after a real discussion about why the book can't just be built from Immortal games — see `build_plan.md` |
| A5 | Rune usage (power runes, bounty runes) | Ignoring free value sitting on the map when nearby | Would need to detect "was a rune up and did anyone grab it" | Would need new work | Low (nice to have, more complex) | |
| A6 | Pulling/stacking jungle camps (common support/offlane job) | Never doing it when the hero/role calls for it | Would need to detect specific pull/stack actions | Would need new work | Low | |

## B. Farming and using resources well (whole game)

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| B1 | Gold per minute vs. normal for hero/role/rank | Well below normal without a good reason (e.g., not explained by being a defensive support) | Gold list, rank bracket | Yes | High | |
| B2 | How efficiently time was used — farming vs. wasting time walking around doing nothing | Long stretches with no last hits and no useful movement (not fighting, not warding, not rotating) | Last-hits list + position list | Yes (needs some real logic to define "wasted time") | Medium | |
| B3 | Reaching core items on time | Key item (e.g. first big damage item) shows up much later than normal for that hero/rank | Item purchase list, rank bracket | Yes | High | |
| B4 | Sitting on unspent gold too long | Having enough gold for a useful item for a while but not buying anything | Gold list + item purchase list | Yes | Medium | |
| B5 | Buyback readiness | Dying late-game with enough gold for buyback but not having kept enough in reserve, or not using it when the team needed them back | Gold list + death list + buyback list | Would need new work (buyback list) | Medium | |

## C. Item and build choices

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| C1 | Build compared to what actually wins for this hero/role/matchup | Building items that statistically underperform for this hero against this enemy lineup | Item purchase list + hero/matchup win-rate data (Tier 1 "book") | Partial — needs the Tier 1 book finished first | High | This is the one that leans hardest on the "book" data from the other plan |
| C2 | Reacting to what the enemy team is doing | Enemy team is mostly magic damage and the player never buys magic resistance; enemy has a big evasion carry and nobody buys a way around it | Item purchase list + enemy hero picks | Yes (have both pieces, needs logic to connect them) | High | |
| C3 | Using the "neutral item" slot well | Carrying a neutral item that doesn't fit the situation, or not upgrading it when a better one is available | Item purchase list | Yes | Low | |
| C4 | Buying and using consumables (wards, smoke, dust, tangoes, town portal scrolls) | Running out of town portal scrolls, never buying dust against an invisible hero, supports not buying wards | Item purchase list + ward list | Yes | Medium | |

## D. Fighting and teamfight decisions

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| D1 | Showing up for fights that happen | A fight breaks out and this player is somewhere else on the map (usually just farming) | Team fight list + position list | Team fight list needs new work | High | |
| D2 | Being ready when a fight starts | Joining a fight with low HP/mana, or a key spell already on cooldown, or no BKB up when it was needed | HP/Mana over time + fight list | Have HP/Mana; fight list needs new work | Medium | |
| D3 | Fighting at good moments, avoiding bad ones | Picking fights when clearly weaker (behind on levels/items), or skipping fights when clearly stronger | Net worth list + fight list | Fight list needs new work | Medium | |
| D4 | Damage dealt vs. damage taken in a fight | Consistently trading badly — taking much more than dealing | Damage list + fight list | Fight list needs new work | Medium | |
| D5 | Getting out alive vs. dying for nothing | Dying in a fight without dealing meaningful damage first, or getting caught alone and killed for free | Death list + damage list + fight list | Fight list needs new work | Medium | |

## E. Deaths, specifically

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| E1 | Where deaths happen | Dying deep in enemy territory, far from help, especially without vision there first | Death list + position list + ward list | Yes | High | |
| E2 | Dying alone vs. dying in a group fight | Solo deaths to a gank are usually more avoidable than a death inside a 5v5 | Death list + fight list | Fight list needs new work | Medium | |
| E3 | Timing of deaths | Dying right before a big moment (about to take Roshan, about to push a tower) is much more costly than a death that doesn't cost the team anything | Death list + objective timing (Roshan/tower list) | Yes | Medium | |
| E4 | Was there a warning sign | Dying to a gank when a ward nearby would have shown it coming, but no ward was placed there | Death list + ward list | Yes | High | |

## F. Vision and map control

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| F1 | Ward placement value | Wards placed in spots that never see anything useful before dying | Ward list + kill list (did anything happen near the ward while it was up) | Yes | Medium | |
| F2 | How long wards survive | Wards getting destroyed almost immediately, over and over, suggests bad placement or no map awareness | Ward list + ward death list | Ward death list needs new work | Medium | |
| F3 | Balance of the two ward types | Only ever buying the "see" wards and never the "counter enemy vision" wards, or vice versa | Ward list | Yes | Low | |
| F4 | Vision before big plays | Contesting Roshan or pushing into enemy territory without scouting it first | Ward list + position list + objective list | Yes (Roshan list needs new work) | Medium | |
| F5 | Clearing enemy wards | Never destroying the other team's wards even when walking right past them | Ward death list | Would need new work | Low | |

## G. Objectives and map presence

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| G1 | Tower damage and participation in taking towers | A core hero who never helps take towers despite having the damage to do so | Tower damage over time + position list | Yes | Medium | |
| G2 | Roshan timing and participation | Taking Roshan at a bad time (low HP team, no vision, enemy nearby), or never taking it when it's clearly available | Roshan kill list + team HP/position | Roshan list needs new work | Low | |
| G3 | Rotating to help other lanes | Staying in one lane farming selfishly while a teammate is losing badly and could use help | Position list + gold/level gaps between lanes | Yes | Medium | |
| G4 | Map control beyond your own lane | Never contesting or applying pressure to the parts of the map outside your own lane | Position list | Yes | Low | |

## H. Support-specific behavior (only scored for support roles)

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| H1 | Ward spending rate | A support who barely buys any wards all game | Item purchase list + role | Yes | High | |
| H2 | Protecting the carry early | Not sticking near the team's main farmer in the first several minutes when the hero is supposed to | Position list (support vs. carry) + role | Yes | Medium | |
| H3 | Using saves/heals at the right moment | Having a heal or save spell available but not using it when a teammate was about to die | Ability cast list + HP over time + death list | Ability cast list needs new work | Low (needs the hardest new data) | |

## I. Carry-specific behavior (only scored for carry roles)

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| I1 | Farm path efficiency | Wasting time walking between camps inefficiently instead of a smooth farming pattern | Position list | Yes | Low | |
| I2 | Buyback discipline late-game | Dying late in the game without buyback available, when that death effectively loses the game | Gold list + death list + game duration | Yes | High | |
| I3 | Knowing when to fight vs. keep farming | Still farming jungle when the team is fighting 4v5 and losing because of it | Position list + fight list | Fight list needs new work | Medium | |

## J. Whole-game impact

| # | What it measures | What "wrong" looks like | Data needed | Have it? | Priority | Notes |
|---|---|---|---|---|---|---|
| J1 | Turning a gold lead into actual progress | Team is way ahead on gold but isn't taking towers/objectives with that lead | Net worth list + objective/building list | Yes | Medium | |
| J2 | Contribution when behind | If the team is losing, did this player's actions help slow the bleeding or make it worse | Net worth list (team-wide) + individual stats over the same stretch | Yes | Low | |
| J3 | Knowing when to end the game | Team clearly winning but game drags on and the advantage gets thrown away | Net worth list over time (does the lead shrink) | Yes | Low | |

---

## Suggested first batch (my recommendation, not a decision)

If I were picking where to start, I'd build the "Priority: High" rows first,
since they mostly use data we already have, no new replay-reading work
required: A1, A2, A7, B1, B3, C2, D1 (once the fight list exists), E1, E4,
H1, I2. That's a genuinely broad first pass across laning, farming,
itemization, fighting, deaths, and role-specific behavior — not narrow at
all — while deliberately leaving the harder, newer-data-required items
(ability casts, Roshan timing, ward-death tracking, team-fight clustering)
for a second pass once the first batch is proven out. A7 (lane setup) is
included in this first batch even though it needs new work, specifically
because A1-A4 can't be interpreted correctly without it — a trilane
support's last-hits at 10 minutes mean something different from a
standard-lane support's, so building the farm/laning categories without
also labeling the lane setup would risk exactly the "book built with a
narrow view of the game" problem this was added to prevent.

## When you're ready to build

Once you've edited this into a shape you're happy with, the instruction to
hand to a building agent is basically: "Read `research/coaching_categories.md`,
build the resolve → download → parse → extract → discard pipeline for the
rows marked Priority: High, storing results the same bounded/aggregate way
already used for HP/Mana in `backend/services/vitals_parser.py`." This file
is written to carry enough detail for that to actually be buildable, not
just a conversation starter.
