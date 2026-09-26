# Project Specifications: Immortal+

## 1. Project Overview
**Name:** Immortal+
**Description:** A comprehensive, locally hosted Dota 2 coaching application designed to help players improve their gameplay through data-driven insights. It provides live draft suggestions, post-game analysis, mistake identification, and progress tracking over time.
**Safety Priority:** 100% compliant with Valve's anti-cheat policies. The app acts purely as an external observer via public APIs and Game State Integration (GSI) and never hooks into the game memory process.

## 2. Core Features
- **Live Draft Helper**: Uses Dota 2 GSI to read visible draft picks and suggests hero counter-picks and synergies based on current meta win rates, matchups, and the player's personal hero pool comfort.
- **Match History & Analytics**: Deep analysis of past games comparing player performance (Laning, Farming, Fighting, Vision, Objectives) against rank-specific benchmarks (e.g., "What does a Divine player's CS look like at 10 minutes?").
- **Actionable Coaching Items**: Post-game generation of specific things to practice (e.g., "Practice last hitting on Anti-Mage — aim for 50 CS by 10:00 (you had 35)").
- **Progress Tracking**: Daily/weekly snapshots and rolling trend graphs of key metrics (KDA, GPM, Winrate) to visualize improvement over time.
- **Custom 2D Replay Viewer (Planned)**: Local parsing of `.dem` replay files to visualize hero movements, ward placements, and teamfights on a 2D HTML5 Canvas minimap.

## 3. Technology Stack
- **Frontend**: React, TypeScript, Vite, React Router, Framer Motion (animations), Recharts (graphs), Vanilla CSS (Custom Design System).
- **Backend**: Python 3.12, FastAPI, SQLModel (SQLAlchemy + Pydantic).
- **Database**: SQLite (WAL mode enabled for high concurrency).
- **External APIs**: OpenDota API (Primary), Stratz GraphQL API (Rank-specific Meta), Steam Web API.
- **Replay Parser**: Java (Clarity library) wrapped in a lightweight Spring Boot service (Placeholder Phase).
- **Deployment**: Docker and Docker Compose (Multi-container architecture).

## 4. Architecture
The application runs entirely locally via Docker Compose, composed of three main containers:
1. **Frontend Container**: Nginx serving the React SPA.
2. **Backend Container**: Uvicorn running FastAPI. Handles all API integrations, caching, business logic, and SQLite database interaction. Exposes port 3001 specifically for receiving GSI payloads from the Dota 2 client.
3. **Replay Parser Container**: Java service responsible for heavy lifting parsing of `.dem` files and exposing a JSON REST API for the Python backend to consume.

## 5. Database Schema (SQLite via SQLModel)
- `players`: Steam ID, account ID, persona name, rank tier, MMR estimate.
- `matches`: Extensively detailed match data (KDA, GPM, XPM, damage, duration, result, JSON blobs for logs and timelines).
- `parsed_replays`: Status of local replay parsing and extracted JSON logs (combat, wards, movements).
- `match_analysis`: Computed scores (0-100) for Laning, Farming, Fighting, Vision, and generated JSON action items/mistakes.
- `progress_snapshots`: Daily/weekly aggregations of player performance.
- `hero_meta`: Rank-bracket specific win rates and pick rates synced from OpenDota.
- `hero_matchups`: Hero vs Hero advantage percentages.
- `pro_meta`: Scraped data from Dota2ProTracker.
- `action_items`: Specific goals assigned to the player (with completion status).
- `user_settings`: Application configuration (API keys, themes, thresholds).

## 6. UI / UX Design Philosophy
- **Aesthetic**: Dota 2 client-inspired. Deep dark theme (base `#0a0c10`), glassmorphism overlays, and gold (`#e2b742`), radiant green, and dire red accents.
- **No Utility Frameworks**: Uses purely custom Vanilla CSS with CSS variables to maintain strict control over the visual identity. 
- **Animations**: Staggered fade-ins, soft pulsing on loading states, interactive card hover effects.
- **Configurability**: Every toggle, API key, and threshold lives entirely within the app's Settings UI page, not in environment variables or docker-compose files.

## 7. Current Status & Detailed Roadmap

### ✅ Phase 1: Scaffolding & Infrastructure (Completed)
- [x] Create React/Vite frontend with custom Vanilla CSS design system.
- [x] Create FastAPI backend with SQLModel, SQLite WAL, and background task engine.
- [x] Set up Docker Compose for unified deployment.
- [x] Configure Nginx proxying for frontend -> backend communication.
- [x] Set up GitHub Actions for automated GHCR Docker builds.

### 🟡 Phase 2: Frontend-Backend Integration (In Progress)
- [x] Fix GSI & UI ports for Docker deployment (9485 Frontend, 9486 API, 9487 GSI).
- [x] Create global Axios API client (`frontend/src/lib/api.ts`).
- [x] Build Settings page with live DB save functionality.
- [x] Wire Dashboard to real `/api/progress/summary` backend.
- [x] Wire Match History page to `/api/matches` and add "Sync Matches" trigger.
- [x] Implement Hero ID to Hero Name/Image mapping.
- [x] Add Steam Account ID configuration input for matchmaking sync.
- [ ] Implement Steam Auth OpenID login flow (Optional).

### 🟡 Phase 3: Live Draft Helper UI & GSI (In Progress)
- [x] Integrate WebSocket connection for live Draft UI updates in frontend and Nginx.
- [x] Build the dynamic draft UI showing synergies and suggestions with real hero images.
- [x] Configure the draft engine to weight meta picks and player comfort.

### ✅ Phase 4: Match Analytics & AI Coach Integration (Completed)
- [x] Use Recharts to build trend graphs for Win Rate, KDA, and GPM on the Dashboard.
- [x] Build Match Detail page to show Laning, Farming, Fighting, Vision scores.
- [x] **AI Coach Integration**: Add configurable OpenAI-compatible API settings (API Key, Base URL, Model Name) to allow providers like `freellmapi`.
- [x] Wire the "Analyze" button on Match History to send detailed parsed match data to the configured LLM endpoint.
- [x] Build the AI Coach UI with tabs comparing mistakes against current rank, target rank, and pro level.
- [x] Generate detailed, personalized Action Items and suggestions per match using LLM.

### ✅ Phase 5: Replay Parser & Live Playback (Completed via OpenDota Logs)
- [x] Wire background Python task to trigger OpenDota parses to extract ward logs, combat events, and item timings.
- [x] Create a "Live Playback" timeline UI to visually point out mistakes extracted from the replay.
- [x] Pass parsed `purchase_log` and `kills_log` into the AI Coach to map Action Items to specific timestamps.
- [x] Full Stratz/OpenDota tab implementation (Benchmarks, Performances, Laning, Combat, Farm, Items, Casts, Objectives, Vision, Actions, Teamfights, Chat, Log) with interactive Map Playback alongside the scoreboard.

### ❌ Phase 6: Dota2ProTracker Hub (Pending)
- [ ] Build Python backend scheduled scraper to fetch live meta data from Dota2ProTracker.
- [ ] Extract and store Position-based win rates, core item timings, and level-by-level skill builds.
- [ ] Build a dedicated frontend "Pro Meta" page to browse highest win-rate heroes by role (Pos 1-5).
- [ ] Integrate ProTracker data into the Live Draft Helper suggestions.

### ✅ Phase 7: Advanced Deep Dive Analytics UI (Completed)
- [x] **Data Density (Dotabuff Style)**: Replicate the tabular layout for all 10 heroes in a match showing Hero, Level, K/D/A, Net Worth, LH/DN, GPM/XPM, Hero Damage, Tower Damage, Healing, Wards Placed/Destroyed, and 6 slotted Items + Backpack/Neutral.
- [x] **Modern Aesthetic (Stratz Style)**: Wrap the tables in dark mode glassmorphic containers, smooth hover states, gradients for Victory/Defeat, and interactive hero portraits.
- [x] **Individual Hero View**: Created an in-game style post-match tab selector to view a specific hero's inventory, stats, and AI coaching.
- [x] **Interactive Match Timeline**: A scrollable horizontal timeline representing the match duration.
- [x] **Timeline Overlays**: Plot Kills, Deaths, Assists, and critical Item Timings (e.g. BKB at 21:00) on the timeline for every hero.
- [x] **AI Suggestions on Timeline**: Plot the AI Coach's generated "Action Items" and "Mistakes" directly onto the timeline (e.g. "Died out of position here at 14:22 - Missing vision").
- [x] **2D Interactive Map**: Plot wards and kills on a 2D Dota map overlay using extracted X/Y coordinates. *Note: Moving forward, the backend should be integrated with STRATZ GraphQL API to guarantee high-fidelity X/Y coordinates, as OpenDota parsing is unreliable for unrequested matches.*

## 8. OpenDota UI Parity & Local Parsing Roadmap

### Phase 1: The Core Metrics (Completed)
- **Local Parsing**: Integrated a background parsing loop (`auto_sync.py`) to bypass OpenDota API rate limits and long queues. Scheduled `fetch_constants.py` to run daily and automatically update tooltips whenever a Dota patch changes.
- **Farm Tab**: Rebuilt to match OpenDota exactly, including GPM/XPM breakdown, Stacked Bar Graphs for gold/xp reasons, and unit kill matrices.
- **Items Tab**: Replicated the timeline view showing exact minute marks for purchases and a RichItemTooltip displaying prices, cooldowns, and descriptions.

### ✅ Phase 2: Visual & Spatial Data (Completed)
- **Graphs Tab**: Implement Recharts to overlay Net Worth, XP, and Win Probability advantages, matching OpenDota's area charts exactly.
- **Vision & Objectives**: Render the interactive Dota 2 minimap using our heatmap component, plotting exact coordinates for wards (`obs_log`, `sen_log`) and tower kills.

### ✅ Phase 3: The Event Logs (Completed)
- **Teamfights & Actions**: Create accordion-style dropdowns for teamfights, calculating gold/xp swings during specific timeframes.
- **Casts Tab**: Map `ability_uses` and `item_uses` into a tabulated format showing cast frequencies.
- **Log, Story, Chat**: Render chronological event lists using the `chat` array parsing exact timestamps.

## 9. Implementation History Log
- **2026-09-24**: Scaffolded core architecture. Configured custom design system. Built backend routers for matches, draft, and settings. Setup GitHub Actions. Mapped correct host ports. Wired basic API endpoints for Settings, Dashboard, and Matches. Fixed SQLModel session bugs.
- **2026-09-24 (Later)**: Mapped Hero IDs to visual portraits. Added Steam Account ID input to Settings to enable profile creation and OpenDota match syncing. Built out the Live Draft UI with WebSockets and configured Nginx to proxy WebSocket Upgrade headers. Added AI Coach and D2PT to the roadmap.
- **2026-09-24 (Evening)**: Completed Phase 4 (Dashboard Recharts, AI Coach backend), Phase 5 (Live Playback Timeline mapping LLM suggestions to timestamps), and Phase 7 (Dotabuff-style 10-player data density scoreboard).
- **2026-09-24 (Night)**: Completed full Phase 5 Stratz/OpenDota tab implementation layout (Benchmarks, Laning, Farm, Combat, Casts, Objectives, Vision, etc.). Fixed Stratz GraphQL schema 400 Bad Request errors. Rebuilt the Overview tab to feature an interactive animated Map Playback side-by-side with the Scoreboard, replicating the Stratz layout using the high-res Stratz map image. Implemented Hero portrait icons dynamically tracking `pos` logs on the interactive map. Enriched OpenDota sync to pull granular data for all players and created a detailed checklist of missing DB models required for the remaining tabs.
- **2026-09-25 (Morning)**: Completely rewrote the internal components for `BenchmarksTab`, `PerformancesTab`, `LaningTab`, `CombatTab`, `FarmTab`, and `ItemsTab`. Implemented high-fidelity data visualization UI matching OpenDota (stacked colored bar charts, dynamic matrices, relative percentage bars, colored percentiles, phase-based item logs, hover tooltips). Updated `sync.py` to aggressively parse and inject deeper OpenDota JSON fields (`deaths_log`, `killed`, `killed_by`, `hero_kills`, `lane_kills`, etc.) to power these UI components.
- **2026-09-25 (Afternoon)**: Built a local JSON database of Dota 2 constants (Heroes, Items, Abilities) by pulling from OpenDota. Centralized all image resolutions and CDN references to `frontend/src/lib/dota.ts` (`getHeroImage`, `getItemImage`, `getAbilityImage`). Replaced all broken Akamai links with Cloudflare and fixed missing ability icons on the Casts Tab.
- **2026-09-25 (Evening)**: Rebuilt the Laning Tab UI to feature an interactive player selection radio button, a dynamic `LaningMap` drawing a red-to-green Heatmap overlay of the player's movements (`lane_pos`), and a Recharts LineChart that highlights the selected player's CS over time. Resolved Recharts Legend bug by mapping `hero.name`. Completely rewrote the `CombatTab` to match OpenDota's UI: merged Kills and Damage matrices into unified 10x10 grids with hover tooltips (`Pudge → Dire: 2`), implemented the Death tables displaying killer hero images and timestamp logs, and mapped `damage_inflictor` APIs to render Damage Dealt and Damage Received tables showcasing ability and item icons alongside exact damage values.
- **2026-09-25 (Night)**: Architected the OpenDota UI Parity and Local Parsing Roadmap. Created `auto_sync.py` to run in the background, autonomously polling, syncing, and parsing new matches in real-time. Scheduled `fetch_constants.py` as a daily background chron job to ensure item/ability tooltips stay updated with the latest Dota 2 patch. Completely rebuilt `FarmTab` with 1-to-1 parity Stacked Bar Graphs for gold/xp reasons using Recharts, and `ItemsTab` with a phase-based purchase timeline and robust `RichItemTooltip` parsing costs, cooldowns, and stats.
- **2026-09-26 (Midnight)**: Configured the local parser Docker container (`odota/parser`) and built `local_parser.py` / `parser_aggregator.py` to autonomously download replays directly from Valve, bypassing Stratz entirely if the Steam API Key is available. Added `SteamClient` in `steam.py` to fetch highly reliable `replay_salt` and `cluster`. Completed Phase 2: Visual & Spatial Data by adding exact Recharts `AreaChart` parity for the Net Worth and XP Advantage graphs on the new `GraphsTab`, and overlaid an interactive Ward / Vision minimap onto the `VisionTab` leveraging the existing `MatchMap`.
- **2026-09-26 (Morning)**: Completely refactored the `FarmTab` to support accurate Last Hits timelines (+deltas) and exact OpenDota Unit Kills tables. Added interactive sorting across all columns in `TeamTable`. Built out Phase 3: The Event Logs, accurately mapping `ability_uses` and `item_uses` grids in `CastsTab`, formatting `ActionsTab`, and creating a fully interactive `TeamfightsTab` with a scrubbable timeline, mini-map death plots, and precise damage/healing grids.
- **2026-09-26 (Afternoon)**: Downloaded local high-resolution Map 7.41 to replace the old minimap. Completely rebuilt the `ObjectivesTab` to exactly mirror OpenDota's table format: added comprehensive Objective Damage columns mapping damage dealt against all structures (Towers 1-4, Melee/Ranged Barracks, Ancients, Shrines, and Roshan) and a full Runes collection table displaying precise rune-specific counts and color-coded horizontal bars.
- **2026-09-26 (Evening)**: Rebuilt the `VisionTab` with 1:1 OpenDota parity. Included an Interactive Vision Map plotting Obs/Sen wards with precise lifetimes connected to a scrubbable Timeline and per-hero filtering checkboxes. Added exact PUR/USE/DUR breakdowns for Observer/Sentry wards (accurately simulating OpenDota's lifespan capping at 360s/420s), Dust, Smoke, and Gem. Recreated the comprehensive Ward Log mapping each ward's timestamp, death, and killer (if de-warded) including a mini-map placement hover preview. Upgraded map hover tooltips to render dynamic `PlayerCell` components indicating hero portraits, aliases, and specific placement/destruction timings cleanly.
- **2026-09-26 (Night)**: Replaced broken Akamai / OpenDota image URLs globally with Valve's Cloudflare CDN to ensure 100% item icon coverage (Wards, Dust, Smoke, etc.). Fixed `VisionTab` Map scaling (`objectFit: contain`) and replaced raw CSS marker dots with exact `ward_observer.png` / `ward_sentry.png` image icons natively embedded over the minimap. Built a custom NPC parser for the Ward Log's "Killed By" column to translate raw database identifiers (`npc_dota_goodguys_siege`) into human-readable strings (`Radiant Siege`).
- **2026-09-27 (Midnight)**: Achieved full 1-to-1 parity on the `ActionsTab` by translating raw OpenDota `order_type` constants (e.g. `DOTA_UNIT_ORDER_MOVE_TO_POSITION`) into UI headers (MV [P], CST [T], GLYPH, SCN) using the `dotaconstants` spec. Rendered precise `PercentBar` components for each action category comparing player activity against the match maximum. Stripped out redundant Fantasy and Cosmetics tabs to streamline the navigation. Fixed a critical bug in `backend/services/sync.py` to correctly extract the raw `actions` payload ensuring data maps properly to the frontend.
- **2026-09-27 (Early Morning)**: Completely re-engineered the `TeamfightsTab`. Designed an interactive scrubbable Timeline mirroring OpenDota's X-axis visualizer: hovered fights render detailed dropdowns listing all participants, hero icons, colored damage/gold deltas (+/-), and exact skull death indicators. Embedded the high-res 7.41 Map reflecting absolute coordinates (`deaths_pos`) of every teamfight casualty. Re-implemented the OpenDota exact "Killed By" Map Tooltip, mapping OpenDota's complex `.killed` internal dictionaries dynamically against the killer's slot/hero ID using custom React mapping logic. Upgraded ability grids and item use grids to match the OpenDota dark aesthetic.
- **2026-09-27 (Morning)**: Rebuilt the `ChatTab`, `LogTab`, and `StoryTab` for full OpenDota 1:1 parity. `ChatTab` now parses actual game `chat_wheel.json` with multi-select faction/type filtering and spam detection. `LogTab` visualizes timelines left-to-right based on radiant/dire positioning with 30-second time gap dividers. `StoryTab` narratively recaps the match dynamically by parsing objectives, gold advantages at the 10/20/30/40 minute thresholds, teamfight deltas, and first-blood assignments. Perfected the `TeamfightsTab` map by including the average teamfight location (with large faction icon and gold delta shadow drop) alongside exact hero portrait map plots for individual casualties, matching OpenDota.


## 10. File Structure & Component Linking

### Frontend (`frontend/src/`)
- `App.tsx`: Main React Router orchestrating navigation.
- `main.tsx`: Entry point.
- **Pages**:
  - `Dashboard.tsx`: Lands on login. Fetches progress from `/api/progress/summary`.
  - `Matches.tsx`: Main history table calling `/api/matches`. Has Sync / Parse triggers.
  - `MatchDetail.tsx`: Single match view. Contains `MatchScoreboard`, `MatchMap`, and the `MatchTabs` logic.
  - `DraftHelper.tsx`: Live draft interface, consumes WebSockets from `/api/draft/ws`.
  - `Settings.tsx`: Modifies `user_settings` table (Steam API Key, OpenAI Key, preferences).
- **Components**:
  - `MatchTabs.tsx`: Houses all detailed tab contents (Benchmarks, Performances, Laning, Combat, Farm, Items, Graphs, Vision, Casts, Actions, Teamfights, Log).
  - `MatchMap.tsx`: Interactive Dota 2 canvas mapping kills, wards, and hero locations dynamically on a scrubbable timeline.
  - `MatchScoreboard.tsx`: Tabular 10-player data density (items, KDA, backpack, levels).
  - `ItemTooltip.tsx` & `RichItemTooltip.tsx`: Parses `items.json` and renders exact costs and stats on hover.
  - `Sidebar.tsx`: Persistent left-hand navigation.
- **Libraries (`lib/`)**:
  - `dota.ts`: Core helper to resolve Hero, Item, and Ability images from Cloudflare CDNs.
  - `api.ts`: Global Axios client setup.
  - `heroes.ts`: Hardcoded hero ID mapping fallback.
  - `constants/`: Locally generated JSON files (`items.json`, `abilities.json`) pulled via `fetch_constants.py`.

### Backend (`backend/`)
- `main.py`: FastAPI root. Bootstraps DB, mounts routers, schedules `auto_sync.py`.
- `models.py`: All SQLModel classes (Matches, Players, Settings, Progress).
- `database.py`: SQLite engine wrapper with WAL enabled.
- **Services (`services/`)**:
  - `sync.py`: Main orchestrator. When a match is synced, tries OpenDota first. If deep data is missing, drops down to Stratz/Steam API for replay_salt and triggers `local_parser.py`.
  - `local_parser.py`: Connects to `odota/parser` via Docker, downloads `.dem.bz2`, extracts, and parses.
  - `parser_aggregator.py`: Reduces the streaming JSON from `odota/parser` into the final OpenDota-style JSON object.
  - `steam.py`: Direct connection to Valve's WebAPI (`GetMatchDetails`) to bypass 3rd party rate limits for replay clusters.
  - `stratz.py`: GraphQL client for pulling Meta and fallback clusters.
  - `opendota.py`: Main integration fetching `/api/matches/{id}`.
  - `analysis_engine.py`: Takes a fully parsed Match JSON and sends it to the configured LLM API (OpenAI) to return `mistakes` and `action_items`.
  - `auto_sync.py`: Indefinite while-loop running in background, checking for new matches on Steam/OpenDota periodically.
  - `fetch_constants.py`: Cron script to redownload `items.json` and `abilities.json`.
- **Routers (`routers/`)**:
  - `matches.py`, `settings.py`, `progress.py`, `draft.py`: Expose JSON REST endpoints.

### Infrastructure
- `docker-compose.yml`: Spins up Nginx, FastAPI, and `odota/parser` on port 5600.
- `Dockerfile.frontend` & `Dockerfile.backend`: Build instructions for GHCR.
- `nginx.conf`: Proxies `/api` to backend and upgrades WebSocket connections for Live Draft.
 
 
### Recent Progress (September 25)
- **Data Sync Pipeline**: Modified `backend/services/sync.py` to stop explicitly filtering keys. The database now stores the entire unadulterated OpenDota `players` array blob (including nested logs, connection events, damage target granularity) to ensure all tabs have complete 1-to-1 parity data.
- **Actions Tab**: Restored the Actions tab component after repairing the `actions` data block in the `sync.py` pipeline.
- **Teamfights Tab**: Fully implemented a 1-to-1 clone of OpenDota's Teamfights visualizer.
  - Interactive scrubbable timeline rendering gold and xp deltas.
  - Map overlay projecting `deaths_pos` directly onto the 7.41 terrain (`m.x / 127` map normalization).
  - Built custom `IconRadiant` and `IconDire` SVGs to replace broken steam CDN pngs.
  - Tooltips precisely matching OpenDota's "Killed By" rendering with dark `rgba(30,30,30,0.95)` backgrounds.
  - Removed deprecated `odota_ui_temp` references, making `MatchTabs.tsx` fully independent.
 
 
- **2026-09-27 (Mid-Morning)**: Rebuilt the ChatTab, LogTab, and StoryTab for full OpenDota 1:1 parity. ChatTab now parses actual game chat_wheel.json with multi-select faction/type filtering and spam detection. LogTab visualizes timelines left-to-right based on radiant/dire positioning with 30-second time gap dividers. StoryTab narratively recaps the match dynamically by parsing objectives, gold advantages at the 10/20/30/40 minute thresholds, teamfight deltas, and first-blood assignments. Perfected the TeamfightsTab map by including the average teamfight location alongside exact hero portrait map plots for individual casualties. Fixed all rendering errors and decoupled components from temporary opendota dependencies.
- **2026-09-26 (Next Morning)**: Diagnosed and fixed the "Parse Replay" broken pipeline. Root cause: OpenDota's free-tier parse queue has priority -2 and can take 30+ minutes or fail silently. Fix: `POST /api/matches/{id}/request-parse` now immediately kicks off a background `FastAPI.BackgroundTask` that downloads the `.dem.bz2` directly from Valve's CDN (cluster/salt from the match record) and pipes it to the local `odota/parser` container — typical completion in 10-30 seconds. OpenDota is still notified as a fallback. Fixed a second bug: the local parser was completely overwriting OpenDota data (losing benchmarks, player names); now merges local parse data into the OD baseline. Fixed parse state persistence via `localStorage` so "Parse Requested" survives page refreshes and polling resumes automatically. Removed emojis from Sync Data / Parse Replay buttons. Added `User-Agent: ImmortalPlus/1.0` header to all OpenDota requests.
- **2026-09-26 (Later Morning)**: Implemented fully automatic match parsing. Created `backend/services/auto_parse.py` — a dedicated `auto_parse_worker` asyncio task that runs alongside `background_sync_loop`. On every 60-second cycle it finds all unprocessed matches, HEAD-checks Valve's CDN for replay availability, submits an OpenDota parse request (for benchmarks/percentiles), runs a local parse via `odota/parser` (for all deep logs), then merges both via `fetch_match_details`. Uses smart retry backoff: 2min → 5min → 10min → 30min between attempts. Gives up permanently after 7 days (Valve's replay retention window). Added `parse_attempts`, `last_parse_attempt`, `parse_failed_permanently` fields to the `Match` model. Auto-migrated to existing DB via `database.py`.
- **2026-09-27 (Later, Part 7)**: Phase 1 of the Stratz-style Overview redesign (see `.claude/plans/resilient-bubbling-hopper.md` for the full plan). Removed the global "Team View" hero-selector bar that rendered on every tab; replaced it with `MatchNavBar` (All Matches/Same Hero/Same Position filter dropdown + a recent-games strip, backed by a new `lane_role` query param on `GET /api/matches`). Rebuilt the Overview tab as `MatchOverview.tsx`: a `MatchupGrid` of lane-paired player cards (KDA, signed net-worth-delta bar, role, rank medal via a newly-verified `opendota.com/assets/.../rank_icons` CDN, and a documented client-side "performance percentile" heuristic — explicitly not a port of Stratz's real algorithm), a Towers/Advantage-graph/Lane-Won row, and a Draft/Builds/Kill-Breakdown row (kill breakdown reuses the `hero_kills`/`tower_kills`/etc. fields already computed by `replay_compute.py`, added in an earlier session). Deleted the standalone "Playback" tab and merged its `MatchMap` into the bottom of Overview via a new `PlaybackSection`, now paired with a new `LiveScoreboardPanel` (live K/D from event logs, GPM/XPM/CS/net worth interpolated from per-minute arrays, items reconstructed from purchase timestamps) sharing one lifted playback clock. Added minute-to-minute linear interpolation to `MatchMap`'s hero movement (previously snapped once per minute) and made its clock optionally externally-controlled without changing its other two existing call sites. Extracted the reusable "Radiant Advantage" area chart out of `GraphsTab` into `AdvantageGraph.tsx` (GraphsTab still renders it, unchanged). Investigated Stratz's actual playback data source (a separate `stratz-frontend.pages.dev` micro-frontend behind a signed JWT, pulling from a Cloudflare-protected REST endpoint) and confirmed real per-second HP/mana bars exist there — not reachable from our side, but reconstructable from the local parser's raw combat-log stream plus a hero stats table; scoped as an explicit fast-follow (on-demand only, never persisting the raw log) rather than blocking this pass. Verified end-to-end against real synced OpenDota data via a temporary local backend instance: unparsed-match graceful degradation (every new section shows a clear "not available" message instead of crashing), Matchup-card click correctly re-enters the existing per-player detail view, and Benchmarks/Graphs/Laning tabs confirmed unaffected by the shared-helper export changes in `MatchTabs.tsx`.
- **2026-09-27 (Later, Part 6)**: Closed the loop on automatic parsing. `auto_parse_worker` already retried every 2/5/10/30 min (purely off `purchase_log IS NULL`, no manual click needed) — confirmed that part was already correct. But its cluster/salt resolution call (and `request_parse`'s, the manual button) never actually fetched Stratz data before calling `resolve_cluster_salt()`, so the Stratz fallback fixed in Part 5 was still unreachable from either path — every automatic retry was only ever trying dead Steam + a fresh OpenDota lookup. Wired a Stratz `get_match()` call into both `auto_parse.py::_parse_one_match` and `routers/matches.py::request_parse` before their `resolve_cluster_salt()` calls, so all three sources are actually tried on every automatic retry cycle as well as on manual "Parse Replay" clicks.
- **2026-09-27 (Later, Part 5)**: Investigated why Steam's `GetMatchDetails` 500s for every match regardless of account/key. Confirmed via direct testing that the key is valid and Dota-authorized (`GetMatchHistory` and `GetMatchHistoryBySequenceNum` both work fine on the same key, and the latter even returns `cluster`), but `GetMatchDetails` — the only Steam Web API endpoint that ever exposed `replay_salt` — is broken Valve-side; no key/account fix resolves it. Confirmed OpenDota itself doesn't get `replay_salt` from this endpoint either: `odota_core/svc/fetcher/GcdataFetcher.ts` shows they run a separate "Retriever" service (real Steam bot accounts holding live Game Coordinator sessions) rather than the public REST API. While explaining this, found and fixed a real bug in the Stratz fallback: `services/stratz.py::get_match()` requests `clusterId`/`replaySalt` in its GraphQL query but never copied them into the `formatted` dict it returns, so `resolve_cluster_salt()`'s Stratz branch (`stratz_data.get("clusterId")`/`.get("replaySalt")`) was always reading `None`/`None`. Fixed — Stratz should now work as a genuine third fallback when both Steam (dead endpoint) and OpenDota (not yet indexed) come up empty.
- **2026-09-27 (Later, Part 4)**: Found why a brand-new match showed "✓ Replay Parsed" with an empty Benchmarks tab. `services/stratz.py::get_match()` hardcodes `"version": 21` on every response it formats (`# indicate parsed`), regardless of whether Stratz actually returned any deep data — Stratz's own player objects never include benchmarks, `killed`, `life_state`, `lane_pos`, or `damage`, only a handful of sparse fields. For the new match, OpenDota 404'd (not indexed yet) and Steam's `GetMatchDetails` 500'd (see below), so `fetch_match_details` fell back to `data = stratz_data` — and `is_parsed` was computed from `data.get("version") is not None`, which read Stratz's fake marker as "fully parsed." Fixed by capturing `od_data_genuinely_parsed` from OpenDota's own response *before* any Stratz data can get involved, and computing `is_parsed = (local_parse_data is not None) or od_data_genuinely_parsed` — Stratz's synthetic version field can no longer influence it. Separately confirmed via direct `curl` against Valve's API that the Steam Web API key in Settings is valid (works fine against generic `ISteamUser` endpoints) but gets a bare 500 from `IDOTA2Match_570/GetMatchDetails` on every match — a known Valve quirk where Dota-specific match endpoints require the key's owning Steam account to actually own/have launched Dota 2. Not a code issue; needs a key regenerated from a Dota-owning account to get the fast cluster/salt path working (OpenDota fallback still works, just slower).
- **2026-09-27 (Later, Part 3)**: Fixed two more bugs surfaced by live testing after the /blob fix. (1) `DetachedInstanceError` crashing every "Parse Replay" click's background task: `request_parse` committed the request-scoped session (to persist a cached `opendota_raw`) right before handing the `settings` ORM object to a `BackgroundTasks` callback — by the time the background task ran, the commit had expired `settings`'s attributes and the owning session was already closed. Fixed by having `_do_local_parse_and_update` fetch its own fresh `settings` from its own session instead of receiving one across that boundary, matching the "extract plain values, don't pass live ORM objects across a session boundary" convention `auto_parse.py` already used. (2) The real headline bug: even with `/blob` parsing working, most tabs (Performances, Laning heatmap/efficiency, Combat deaths/damage breakdowns, Farm unit-kill categories, ...) were still blank. Root cause: `fetch_match_details`'s merge only copied a hand-picked ~19-key whitelist from the local parse into the stored match, and several fields the UI needs (`life_state_dead`, `buyback_count`, `lane_efficiency_pct`, `lane`/`lane_role`, categorized kill counts like `hero_kills`/`tower_kills`) aren't raw parser output at all — OpenDota's own backend *computes* them from raw fields (`life_state`, `buyback_log`, `gold_t`, `lane_pos`, `killed`) via `svc/util/compute.ts`. Ported those exact formulas (verified against a real captured parser response in `odota_core/json/`) into new `backend/services/replay_compute.py`, and replaced the whitelist with a full merge of every raw+computed field from the local parse into the stored match — eliminating the whack-a-mole of missing individual field names for every tab going forward.
- **2026-09-27 (Later, Part 2)**: Found the actual root cause of local parsing still failing after the fix below: `local_parser.py` was calling `odota/parser`'s root `/` endpoint with raw `.dem` bytes (POST), which returns an *unaggregated* low-level combat-log/entity event stream (tens of thousands of individual event lines) — there is no way to reconstruct `purchase_log`/`gold_t`/etc. from that. Confirmed against the vendored `odota_core` reference (`svc/fetcher/ParsedFetcher.ts`): the real OpenDota backend calls `GET /blob?replay_url=<url>` instead — the parser downloads, decompresses (bz2 or zstd), parses, *and aggregates* the replay itself, returning one JSON object already shaped like OpenDota's match format. Rewrote `local_parser.py` to call that endpoint directly, which also made the manual bz2/zstd decompression code and the `parser_aggregator.py` NDJSON-hunting logic dead weight — deleted `parser_aggregator.py` and removed all three call sites. Also fixed a real inefficiency the logs exposed: three concurrent entry points (auto-parse worker, the manual button, and polling GETs) could each independently trigger a full duplicate download+parse of the same match at once; `local_parser.py` now coalesces concurrent calls for the same `match_id` onto a single in-flight parse task. Fixed a stale `REPLAY_PARSER_URL` default in `config.py` (wrong hostname/port; harmless under Docker Compose since it's always overridden by env, but wrong for local dev).
- **2026-09-27 (Later)**: Fixed the root cause of matches showing "✓ Replay Parsed" with every deep-data tab empty. Three compounding bugs in the parse pipeline: (1) `auto_parse.py::_parse_one_match` successfully local-parsed replays via `odota/parser` but then discarded the result and re-derived data from scratch via `fetch_match_details`, which had no way to recover the already-parsed logs; (2) both the auto-parse worker and the manual "Parse Replay" button (`routers/matches.py::request_parse`) resolved `cluster`/`replay_salt` using only OpenDota's own `/matches/{id}` response — which is rarely populated in the few seconds right after submitting a parse request — completely bypassing the `SteamClient` fast-path that was built specifically to solve this; (3) `routers/matches.py::_do_local_parse_and_update` force-set `match.is_parsed = True` whenever `fetch_match_details` returned *any* data, even bare OpenDota summary data with no `purchase_log`/`benchmarks`, which is what produced the misleading "Replay Parsed" badge. Fixes: added a single shared `resolve_cluster_salt()` helper in `steam.py` (tries stored `opendota_raw` → Steam API → fresh OpenDota fetch → Stratz, in that order) now used by all three parse entry points; `fetch_match_details()` gained an optional `local_parse_data` parameter so callers that already parsed a replay pass it straight through instead of losing it; `is_parsed` is now computed from whether `purchase_log` actually landed (`bool(player_data.get("purchase_log")) or data.get("version") is not None`) instead of being forced. Also deleted `backend/services/auto_sync.py` — an orphaned, never-imported predecessor of `auto_parse.py`/`background_sync_loop` that was dead code left over from an earlier refactor.
- **2026-09-26 (Afternoon)**: Fixed three critical bugs breaking the local parser pipeline: (1) The `odota/parser` Docker container exposes port 5600, but `docker-compose.yml` had `REPLAY_PARSER_URL` pointing to port 8001, causing silent connection failures. (2) `parser_aggregator.py` was a stub; rewrote it to properly extract the valid JSON object from the parser's JSONL output stream. (3) The auto-parse worker was skipping matches where OpenDota set `is_parsed=True` but the deep parse data (`purchase_log`) was missing; updated the SQL query to target matches where `purchase_log IS NULL`. Also fixed premature `is_parsed=True` setting in the `request-parse` route.