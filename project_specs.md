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

## 8. Implementation History Log
- **2026-09-24**: Scaffolded core architecture. Configured custom design system. Built backend routers for matches, draft, and settings. Setup GitHub Actions. Mapped correct host ports. Wired basic API endpoints for Settings, Dashboard, and Matches. Fixed SQLModel session bugs.
- **2026-09-24 (Later)**: Mapped Hero IDs to visual portraits. Added Steam Account ID input to Settings to enable profile creation and OpenDota match syncing. Built out the Live Draft UI with WebSockets and configured Nginx to proxy WebSocket Upgrade headers. Added AI Coach and D2PT to the roadmap.
- **2026-09-24 (Evening)**: Completed Phase 4 (Dashboard Recharts, AI Coach backend), Phase 5 (Live Playback Timeline mapping LLM suggestions to timestamps), and Phase 7 (Dotabuff-style 10-player data density scoreboard).
- **2026-09-24 (Night)**: Completed full Phase 5 Stratz/OpenDota tab implementation layout (Benchmarks, Laning, Farm, Combat, Casts, Objectives, Vision, etc.). Fixed Stratz GraphQL schema 400 Bad Request errors. Rebuilt the Overview tab to feature an interactive animated Map Playback side-by-side with the Scoreboard, replicating the Stratz layout using the high-res Stratz map image. Implemented Hero portrait icons dynamically tracking `pos` logs on the interactive map. Enriched OpenDota sync to pull granular data for all players and created a detailed checklist of missing DB models required for the remaining tabs.
