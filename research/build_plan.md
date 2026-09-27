# The full build plan: from raw replays to personalized coaching advice

This is the complete, step-by-step plan — written so a future agent (or
you) can pick it up and actually build it, not just talk about it. Plain
language throughout. Where a technical term is genuinely necessary, it's
explained the first time it shows up.

## The big picture, in one paragraph

We collect a large number of real matches across every rank. From those
matches, we build a "book" — a record of what normal, winning play
actually looks like, broken down by hero, role, and rank (a Herald support
Lich and an Immortal support Lich play very differently, so they need
separate books). Once we have enough matches to trust that book, we also
train a simple model that estimates a team's win chance from the state of
the game at any moment. Then, when someone opens one of their own matches
in the app, we replay their decisions against the book and the model, and
tell them specifically where they gained or lost win probability, and
why — pointing at real moments in their game, not vague advice.

---

## Phase 1: Collect the data

### 1a. Find matches to look at — and make sure every rank actually gets covered

**Don't just collect whatever's easiest to grab.** The book is separate
per rank on purpose (see the big picture above) — a Herald Lich and an
Immortal Lich get compared against different, rank-appropriate norms.
That only works if we actually have enough real matches *at every rank*,
not mostly the ranks that happen to be easiest to pull. This matters for
a concrete reason: things like trilaning (three heroes sharing one lane)
are common and often correct at some skill levels and rare at others — if
we only collected from the top ranks, we'd never see it, and the book
would have no idea it's a legitimate pattern rather than a mistake, for
the ranks where it actually is one.

The good news: rank populations in Dota form a pyramid — far more players
sit in Herald through Legend than in Immortal. So the lower ranks will
naturally fill up with reliable data *faster*, not slower. Immortal is the
scarce, slow-to-fill bracket. The practical rule: when running the
collector, deliberately run it across every bracket (Herald, Guardian,
Crusader, Archon, Legend, Ancient, Divine, Immortal) — `harvest_public_matches.py`
already supports this via `--rank-min`/`--rank-max`, it just needs to
actually be pointed at each bracket in turn rather than left on defaults
that would naturally over-collect from whichever bracket has the most
live traffic at any given moment.

Two separate sources, already built and tested this session:

- **`research/harvest_public_matches.py`** — pulls draft + outcome + rank
  for a large batch of matches at once, using OpenDota's "Explorer" tool
  (a way to ask their database questions directly). This gives us who
  picked what, who won, and what rank the match was, for thousands of
  matches very quickly, with no need to download a single replay.
- **`services/opendota.py`'s `get_public_matches()`** — a live feed of
  matches as they finish, a few dozen at a time, for whenever we want to
  keep watching for fresh matches going forward instead of digging into
  the past.

### 1b. Get the actual replay for a match

This is the part that needed real investigation this session, because it
turned out to be genuinely hard — worth understanding why, so nobody
"fixes" this the wrong way later:

- OpenDota and Stratz (two well-known Dota stats services) only reliably
  have replay access for matches someone has specifically asked about
  before (a tracked player, an explicit request). For a random match
  nobody has looked at, they usually don't have it — tested live, and
  confirmed: OpenDota had it for about 1 in 40 random matches, Stratz had
  no record at all for 8 out of 10.
- The real fix: **`gc-bot`**, a small service we built this session that
  stays logged into a dedicated Steam account with Dota 2 and can ask
  Valve directly, for any match ID, "where is this replay." Tested live
  against 25 real matches (including the exact ones OpenDota/Stratz had
  both failed on): **25 out of 25 worked.**
- Call `gc-bot`'s `GET /resolve/<match id>` — it gives back two numbers
  (`cluster` and `replay_salt`) that are needed to build the actual
  download link.
- Build the download link and download the replay. The code for this
  already exists and works — see `backend/services/vitals_parser.py`,
  the `parse_hero_vitals` function, the part that builds a URL like
  `http://replay184.valve.net/570/<match id>_<salt>.dem.bz2` and downloads
  it.
- **Important, tested this session**: downloading sometimes fails on the
  first try (Valve's servers occasionally return an error that isn't
  "this doesn't exist," it's "try again") — tested live: about 1 in 3
  worked on the first try, about 7 in 10 worked within two tries. **Any
  real downloader needs to retry a failed download 2-3 times with a short
  pause in between, instead of giving up after one attempt.** This isn't
  a guess — it's a measured, real result from testing this session.

### 1c. Turn the replay into numbers

- Decompress the downloaded file (it arrives compressed) and send it to
  our own parser (`replay_parser`, already running, already extended this
  session with several real new capabilities).
- Walk through the categories in `research/coaching_categories.md`,
  starting with everything marked **Priority: High** — pull out the exact
  numbers each one needs (using the "raw ingredients" reference table at
  the top of that file to know exactly which list/field to read).

### 1d. Don't keep the replay

This is important and was a deliberate design decision earlier in this
project: storage is limited, so **the replay file and the raw parsed data
get thrown away immediately after the numbers are pulled out of them.**
Nothing about the actual match gets kept — only small running totals
(counts, running averages, small samples for statistics) get updated and
saved. If a category is added later that needs something we didn't save,
the fix is to re-download and re-parse that match (`gc-bot` + the parser
make that easy to do again) — not to have hoarded the replay "just in
case."

### 1e. Where the numbers get stored

Small, fixed-size tables that don't grow no matter how many matches get
processed — this was worked out carefully earlier in this project because
of the storage limit:

- **Counts** (win rates, pick rates) — just two numbers per bucket
  (wins, total). Tiny.
- **Typical-range numbers** (last hits at 10 minutes, gold per minute,
  item timing) — instead of saving every single match's number forever
  (which would grow without limit), keep a small random sample per bucket
  (around 300 real numbers) that gets updated as new matches come in. This
  is a well-known, reliable statistics trick called "reservoir sampling" —
  the plain version: imagine a bucket that can hold 300 marbles; every
  time a new marble (a new match's number) comes in after the bucket is
  full, there's a fair, math-guaranteed chance it bumps out a random
  existing marble instead of just being thrown away. The result stays a
  fair, representative sample of everything ever seen, forever, without
  the bucket ever growing past 300.
- **Map-position data** (where players stand, where wards get placed) —
  a fixed grid over the map, where each square just counts how often
  something happened there. The grid size never changes.

A "bucket" everywhere above means one specific combination — e.g., "Lich,
playing support, Legend rank, patch 7.38, last-hits-at-10-minutes."

---

## Phase 2: Know when the book can be trusted

Don't serve advice from a bucket that only has a handful of matches in
it — that's not a real pattern, it's noise. The rule: **a bucket needs at
least 100 real matches before it's used for anything, and ideally the
full 300 before it's treated as fully reliable.** This number isn't
arbitrary — it matches the size of the sample we're already keeping per
bucket (see above), and 100-300 is a standard, sensible range for this
kind of statistic to stop being noisy in practice.

Every bucket keeps track of how many real matches went into it (a plain
counter). The app should always be able to say, honestly, "we don't have
enough data yet for this specific hero at this specific rank" rather than
pretending to know something it doesn't — this matches how the rest of
this project has always handled missing data: disclose it, don't fake it.

---

## Phase 3: Build the two things that actually produce advice

### 3a. The book (mostly already covered above)

Once buckets have enough matches, the book is just: for this hero, this
role, this rank, this patch — here's the normal range for each category
in `coaching_categories.md`, and here's what winning players specifically
do differently from losing players.

### 3b. The win-chance model ("training" — explained plainly)

Separate from the book, we also want something that can look at a
snapshot of a game in progress (gold difference, kills, who's alive, time
elapsed, etc.) and estimate "who's more likely to win from here." This is
what "training a model" means in this project, and it's worth being clear
about what it is *not*: it is not a giant AI/neural network, it doesn't
need a GPU, and it's not the "Stockfish plays out every possible future"
idea (that was explicitly ruled out early in this project as too big for
what we're building).

What it actually is: a well-established, simple kind of prediction tool
(the standard choice is called "gradient-boosted trees" — in plain terms,
think of it as a big, automatically-built flowchart of yes/no questions
like "is the gold lead over 5000 at this point in the game?" that,
combined together, produce a percentage). It's trained by showing it
thousands of real match snapshots along with the real final outcome (who
actually won), and it learns which patterns of numbers tend to go with
winning. This runs fine on an ordinary computer/server, trains in minutes
to a couple of hours depending on how much data there is, and doesn't need
special hardware.

This step only happens **after Phase 1 has produced enough matches** —
there's no point training on too little data, same reasoning as Phase 2.

**Retraining**: this isn't a one-time thing. Dota changes with every game
patch (new items, hero reworks, balance changes), so the book and the
model both need refreshing over time. The earlier planning already worked
out how to handle this without starting over every patch — see the
"Handling patch changes" section in `research/README.md` — new data gets
full trust, older-patch data gets used as a fallback with reduced trust
rather than thrown away, and some things ("missing farm is bad") never
need to change patch to patch at all.

---

## Phase 4: Turn this into advice for an actual person

This is the part that makes everything above worth doing. When a user
opens a specific match of theirs in the app (or asks for a review of a
recent game):

1. Make sure that match has been fully parsed (the app already knows how
   to trigger this — same pattern already used for HP/Mana this session).
2. Pull out the same numbers, for this one match, that Phase 1 pulls out
   at scale for the book (same code, just run once instead of thousands
   of times).
3. For each category, compare this player's real number against the book
   entry for their exact hero/role/rank/patch. How far off from normal
   were they, and in which direction?
4. Weight each category by how much it actually tends to matter for
   winning (this is what the win-chance model from Phase 3b is for — it
   lets us say "missing this fight cost you roughly X% win chance," not
   just "you missed a fight").
5. Add up all the categories into one overall score, plus a breakdown by
   category, plus a short list of the specific worst moments, named
   plainly — e.g. "18:03 — your team fought at Roshan and you were
   farming the jungle instead; players in your rank join this fight about
   7 times out of 10."
6. Show this to the user. The natural place is a new tab/section on the
   match page, similar in spirit to how a chess app shows you exactly
   where a game was won or lost, move by move — except here it's built
   from real statistics about real players at your rank, not a search
   engine.

If a hero/role/rank bucket doesn't have enough data yet (Phase 2), that
category should visibly say so instead of guessing — same honesty rule
as everywhere else in this project.

---

## Where this actually lives in the codebase (for whoever builds it)

- **Collector** — a new background service/script (natural home:
  alongside `research/harvest_public_matches.py`, or eventually promoted
  into `backend/services/` once it's proven out) that loops through
  Phase 1 continuously: find matches → resolve via `gc-bot` → download
  with retries → parse → extract the Priority: High categories → update
  the small aggregate tables → throw away the replay.
- **Aggregate storage** — new, small, fixed-size tables (SQLite is fine
  at this scale) holding the counts/samples/grids from Phase 1e.
- **The book + model** — a small service that reads the aggregate tables
  and answers questions like "what's normal for this hero/role/rank" and
  "what's the win-chance estimate for this game state." Retrained
  periodically (Phase 3b), not on every request.
- **The scoring/report step (Phase 4)** — a new backend endpoint that,
  given a match ID a user is looking at, runs steps 2-5 of Phase 4 and
  returns a report.
- **The frontend** — a new tab or section on the match page that calls
  that endpoint and displays the report, in the same visual style as the
  rest of the app.

## What to hand a future building agent

Point it at three files, in this order: this one (`build_plan.md`, the
overall plan), `coaching_categories.md` (exactly which numbers to pull
out of each match and why), and `README.md` in this same folder (the
underlying technical decisions — storage limits, why raw rows get pulled
from Explorer instead of aggregated server-side, the patch-handling
approach). Tell it to start with Phase 1 for the Priority: High categories
only, and not to build Phase 3/4 until Phase 1 has actually produced
enough real data to make Phase 2's "is this trustworthy yet" check pass
for a meaningful number of hero/role/rank buckets — building the report
UI before there's real data to show would just be building against
nothing.
