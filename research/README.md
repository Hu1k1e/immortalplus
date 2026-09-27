# Hyper-personalized recommendation engine — project plan

## Framing

The "Stockfish for Dota" pitch needs a scope correction before anything else:
chess engines get their strength from search over a small, fully-known,
discrete state space with a clean legal-move list. Dota's state space is
enormous, continuous, and partially observable (fog of war) — a true
search-based engine (self-play RL, à la OpenAI Five) needs datacenter-scale
compute, not a side project. That's explicitly out of scope here.

What chess engines actually give value from, that *is* tractable:

1. **A static evaluation function** — given a game state, estimate win
   probability. Standard supervised learning on historical outcomes.
2. **An opening book** — precomputed, statistically-strong lines for known
   situations (draft synergies/counters by rank, lane assignments, item
   timings). Aggregation + statistics, not learning.

Together these get you real "hyper-personalized recommendations": for a
given role/hero/matchup/game-state, compare what the book says and what the
eval function says about deviating from it. This is the actual target.

**The full, editable list of exactly what "doing something wrong" means —
every category, in plain language, with what data each one needs and
whether we have that data yet — lives in
[coaching_categories.md](coaching_categories.md).** That file is meant to
be edited directly as the category list gets refined, then handed to a
building agent when ready.

## How much do we actually need to store? (resolved)

Storing every individual match (raw or parsed) doesn't scale — millions of
matches × even a compact per-match record is tens of gigabytes for no real
benefit once you only need statistics, not the matches themselves. The right
target is **precomputed aggregate tables** (percentile curves, win-rate
matrices, item-build win rates), which land around 500MB-1GB total even at
full hero×role×rank×patch granularity — several orders of magnitude smaller
than a raw match corpus, and this is what actually gets queried at
recommendation time (a single indexed lookup, not a scan over millions of
rows).

## Bootstrapping speed — validated live, not assumed

Tested directly against the real OpenDota API (not just planned):

- **`/heroStats` returns rank-bucketed pick/win counts for all 127 heroes
  in a single call** — `1_pick`/`1_win` through `8_pick`/`8_win`, one bracket
  per medal tier. That's real per-rank win-rate data for the entire hero
  pool, free and instant. This should be the very first thing pulled —
  it's most of a basic "book" for near-zero cost.
- **A single Explorer query returned 5,000 real match rows in 0.6 seconds.**
  Backfilling tens of thousands of matches per rank bracket is minutes of
  work via a handful of calls, not a slow daily trickle.
- **Correction to an earlier plan draft**: pushing `GROUP BY`/aggregation
  into the Explorer SQL itself (to avoid storing raw rows at all) does
  **not** work — tested live, Explorer's public sandbox rejects any
  `GROUP BY` query with a 400, even a trivial one. It only allows raw
  `SELECT`s. So the real pattern is: pull raw per-match rows fast (already
  built, already fast — see `harvest_public_matches.py`), aggregate
  locally in SQLite/pandas. This is a minor correction, not a blocker —
  the fast bulk pull already makes this cheap.

**Bottom line: no slow daily drip needed for Tier 1 (draft/outcome/rank).**
`/heroStats` plus a handful of bulk Explorer pulls gets a substantial "book"
built in well under an hour of wall-clock time, bounded by the existing rate
limiter (60 req/min), not by data availability. Tier 2 (replay-based
features — item timings, lane outcomes, position/ward value) is the part
that genuinely benefits from running in the background over days, since
it's bounded by our own parser's CPU/bandwidth, not by OpenDota's API.

## Architecture (three tiers, cheapest first)

1. **Draft + outcome + rank.** `/heroStats` (free, one call) for basic
   per-hero rank-bucketed win rates, plus bulk raw-row pulls via Explorer
   SQL (`harvest_public_matches.py`, already built and verified) for
   anything `/heroStats` doesn't cover at the needed granularity — matchup/
   synergy matrices split by rank bracket (the public `/heroes/{id}/matchups`
   endpoint is all-rank, not bracket-specific), item-build win rates,
   timing benchmarks. Zero replay parsing needed for this whole tier.
2. **Lane/laning-phase outcomes, item timings, decision points.** Needs full
   replay parsing. Route through the app's own self-hosted parser (`../parser/`,
   already running and extended this session for real HP/Mana/hero-damage/
   healing/tower-damage) rather than OpenDota's rate-limited parse queue —
   unlimited, bounded only by CPU/bandwidth. This is the tier worth running
   continuously in the background over time.
3. **Derived features only, never raw replays at rest.** A parsed replay is
   50-100MB+; at scale you want a feature vector per match/player (a few
   KB), not the replay itself. Parse, extract, discard — same storage-
   bounding principle the app's on-demand HP/Mana feature already follows.

## Precomputed aggregate schema (what actually gets queried at recommendation time)

Adapting a solid schema sketch from an earlier planning pass, kept here
rather than duplicated into `models.py` until Tier 1 has real data to
validate the shapes against:

- **`optimal_benchmarks`**: hero_id × role × rank_bracket × patch_version ×
  metric_name (cs_10, gpm, fight_join_pct, ...) → percentiles (p10-p90) +
  winning_avg/losing_avg + sample_size. The core "book" table.
- **`item_build_winrates`**: hero_id × role × rank_bracket × patch_version ×
  item_sequence (first N major items) → win_rate, pick_rate, avg_timing,
  sample_size.
- **`hero_matchup_matrix`**: hero_id × opposing_hero_id × rank_bracket ×
  patch_version → win_rate, sample_size. (Rank-specific — the gap
  `/heroes/{id}/matchups` doesn't cover, needs the Explorer raw-pull path.)
- **`draft_evaluation`**: patch_version × rank_bracket × allies[] × enemies[]
  × bans[] → ranked best-next-picks with expected win rate. Effectively an
  opening book keyed by draft state.

Every row carries `sample_size` — never surface a recommendation from a
bucket too small to trust; this is the honesty mechanism, matching this
project's established "never fabricate, disclose the real limitation"
convention rather than a new one invented for this subproject.

## Recommendation engine concept: Expected Win Contribution (EWC)

The concrete answer to "how does this become hyper-personalized
recommendations": for a given match+player, walk their real decision
points (item choices/timing vs. `item_build_winrates`, farm efficiency vs.
`optimal_benchmarks` percentiles, fight participation vs. teamfight
benchmarks, positioning vs. position data, ward value vs. ward benchmarks)
and score each as `decision_impact × decision_deviation` — how much that
category matters × how far the actual decision was from the benchmark.
Sum for an overall EWC ("this game cost/gained you ~X% win probability"),
broken down by category, with the worst individual moments called out by
name and timestamp. This is the same shape as a chess engine's move-by-move
eval graph with annotated blunders — the actual "Stockfish" experience,
without needing search, because it's benchmark comparison, not lookahead.

This is real, buildable work for later (needs Tier 1 book data to compare
against, ideally some Tier 2 replay features for fight/position/ward
scoring) — not yet started, but it's the concrete shape "recommendation
surface" should take, resolving what was previously an open question.

## Handling patch changes (meta shifts, not just more data)

Every aggregate row is tagged with `patch_version`. Two real, separate
failure modes to design for:

- **Sparse data right after a patch**: blend current-patch data with a
  decayed weight on the previous patch (e.g. `0.7 ** patches_ago`) until
  current-patch sample size crosses a trust threshold, rather than either
  refusing to answer or overconfidently trusting a tiny sample.
- **Some truths don't decay at all.** Separate "universal truths" (missing
  CS is bad, dying without buyback late is bad, not joining fights when
  you have a power spike is bad — these hold across patches) from "meta
  truths" (this hero's win rate, this item-first-build's win rate — these
  are patch-specific and need real current-patch sample size). A
  recommendation engine should keep giving useful universal-truth feedback
  immediately after a patch even while meta-truth confidence is still low,
  rather than going silent or stale.

## Data source reality check (matters for planning volume)

- OpenDota's Explorer queries their existing warehouse — it does **not**
  reach further back than what OpenDota has already ingested from Valve's
  live match stream. There's no bulk historical archive beyond that via the
  free API. Realistic volume comes from: (a) backfilling what Explorer
  already has (large but finite per rank bracket — lower brackets have far
  more matches than Immortal), and (b) running the harvester repeatedly
  over time to keep accumulating as new matches get played and ingested.
- Free tier: 60 req/min, 50,000 req/month (the app's existing
  `services/opendota.py` rate limiter already enforces this — the harvester
  reuses that client rather than a second, uncoordinated limiter, so it's
  safe to run alongside the live app without risking a 429 that affects it).
  A paid OpenDota API key raises these limits significantly if volume
  becomes the bottleneck.
- Rank tiers use `avg_rank_tier` (medal×10 + star): Herald 10-19, Guardian
  20-29, Crusader 30-39, Archon 40-49, Legend 50-59, Ancient 60-69,
  Divine 70-79, Immortal 80 (no stars — much lower match volume than
  other brackets, will fill in slowest).
- Filtered to `lobby_type = 7` (Ranked Matchmaking) and excludes Turbo
  (`game_mode 23`, different pace/economy — would contaminate rank-based
  stats if mixed with normal-paced games) by default. Both configurable.

## Status

**Done:**
- `harvest_public_matches.py` — resumable Explorer-based harvester for
  match_id/radiant_win/start_time/duration/avg_rank_tier/radiant_team/
  dire_team into `data/public_matches.db` (SQLite). Verified live: correct
  schema, real hero-ID arrays, confirmed resumable (a second run correctly
  fetched older matches via the `match_id <` cursor without duplicating).
- Validated `/heroStats` as a near-free source of rank-bucketed per-hero
  win rates (see above) — not yet wired into a harvester script.
- Kept deliberately separate from `backend/` — the access pattern (bulk
  writes, analytical reads) is different enough that it shouldn't be swept
  into the production app's Docker build/CI, but it does import
  `backend/services/opendota.py` directly to reuse the existing
  rate-limited, cached client rather than duplicating that logic.

**Not started:**
- A `fetch_hero_stats_snapshot.py` script to pull and store `/heroStats`
  (trivial — one call, should exist alongside the match harvester).
- Feature/analysis layer on top of the harvested draft data (hero synergy/
  counter matrices, win rate by rank, pick/ban trends) — this is pure SQL/
  pandas over what's already being collected, no new data needed.
- The `optimal_benchmarks`/`item_build_winrates`/`hero_matchup_matrix`/
  `draft_evaluation` tables described above.
- Tier 2: replay-based feature extraction (lane outcomes, item timings,
  decision points) via the local parser.
- Model training (LightGBM/XGBoost recommended for the win-probability eval
  function — trains in minutes, interpretable, reasonable MVP; save deep
  learning for later, if ever).
- The EWC scoring engine and its integration into the app (real-time GSI
  overlay vs. post-game analysis timeline is still an open design decision
  for *how* it's surfaced, even though *what* it computes is now sketched).

## Running the harvester

```bash
cd research
# Uses backend/venv's Python (httpx already installed there)
../backend/venv/Scripts/python.exe harvest_public_matches.py --rank-min 10 --rank-max 80 --target 20000

# Or target a specific bracket, e.g. Immortal only (slow to fill — low volume)
../backend/venv/Scripts/python.exe harvest_public_matches.py --rank-min 80 --rank-max 80 --target 2000
```

Safe to Ctrl+C and re-run — it resumes from the oldest match_id already
stored for that rank bracket rather than re-fetching or duplicating.
Consider running one bracket at a time (or several in sequence) rather than
the full 10-80 range in one call, so lower-volume brackets like Immortal
aren't starved by how `avg_rank_tier BETWEEN` naturally biases toward the
much higher-volume mid brackets first when ordered by recency.
