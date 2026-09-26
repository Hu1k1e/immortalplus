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
- **2026-09-27 (Midnight)**: Achieved full 1-to-1 parity on the `ActionsTab` by translating raw OpenDota `order_type` constants (e.g. `DOTA_UNIT_ORDER_MOVE_TO_POSITION`) into UI headers (MV [P], CST [T], GLYPH, SCN) using the `dotaconstants` spec. Rendered precise `PercentBar` components for each action category comparing player activity against the match maximum. Stripped out redundant Fantasy and Cosmetics tabs to streamline the navigation.


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
