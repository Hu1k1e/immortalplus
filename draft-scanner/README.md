# draft-scanner

A small local companion app that fills the one real gap in the Draft
Helper: **Ranked All Pick (and every mode except Captain's Mode) never
exposes opponent picks/bans through any API** — not GSI, and (confirmed
via Valve's own 7.35d patch notes, which deliberately blanked this data
in response to the "OverPlus"/Overwolf controversy) not even Overwolf's
officially-sanctioned game integration. The only channel Valve hasn't
closed is reading what's already rendered to your own screen — this app
does that: screen capture + hero-portrait feature matching for picks,
OCR for bans (see below), no game-memory access, no process injection
(same category as OBS or Discord's screen share, not the category Valve
has warned about banning for).

Runs on your **gaming PC** (the same machine running Dota 2), not the
Docker backend — it needs real access to your monitor.

## For end users: just run the .exe

Download `draft-scanner.exe` and double-click it. That's it — no Python,
no pip, no separate Tesseract install; everything needed is bundled
inside the one file. A console window opens and shows what it's doing
("watching for a draft...", then picks/bans as they're detected during
a real draft). Leave it running in the background while you play; close
the window when you're done.

It points at the shared backend (`https://dota.hulksmash.ca`) by
default — nothing to configure.

## For developers: running from source

```bash
cd draft-scanner
pip install -r requirements.txt
```

Also install the **Tesseract OCR engine** (a separate binary — the
`pytesseract` package is just a Python wrapper around it, and bans are
read via OCR, not icon matching — see "Why bans use OCR" below):

- Windows: https://github.com/UB-Mannheim/tesseract/wiki (installer),
  or `choco install tesseract` from an elevated shell.
- Confirm it's on PATH: `tesseract --version` (open a **new** terminal
  first — PATH changes from an installer don't reach already-open
  shells). `ban_ocr.py` also checks the standard install locations
  directly if PATH still doesn't pick it up, which is common right
  after a fresh install.

Set `IMMORTALPLUS_BACKEND_URL` if your backend isn't at the default
(`https://dota.hulksmash.ca`) — see `config.py`.

```bash
python main.py
```

## Building the .exe

One-time staging step (trims Tesseract's full install down to just what
this app needs — the full install also has Java training tools and
script-detection data never used here):

```bash
mkdir _tesseract_bundle
mkdir _tesseract_bundle\tessdata
copy "C:\Program Files\Tesseract-OCR\tesseract.exe" _tesseract_bundle\
copy "C:\Program Files\Tesseract-OCR\*.dll" _tesseract_bundle\
copy "C:\Program Files\Tesseract-OCR\tessdata\eng.traineddata" _tesseract_bundle\tessdata\
```

Then:

```bash
pip install -r requirements-build.txt
pyinstaller build.spec --noconfirm
```

Output: `dist/draft-scanner.exe` (~137MB — mostly the bundled Python
runtime, OpenCV, and Tesseract; verified working end-to-end, including
the bundled-Tesseract path resolution and the persistent icon cache at
`%LOCALAPPDATA%\draft-scanner\`, which is separate from `_tesseract_bundle`
specifically so a fresh `--onefile` extraction on every launch doesn't
force a 125-icon re-download every time — see `config.py`).

## Why bans use OCR, not icon matching

Picks render as hero portraits. Bans don't — Ranked All Pick's auto-bans
show up as plain scrolling text in the chat/log panel ("Phantom Assassin
has been Banned."), confirmed directly from a real capture. There's no
ban icon strip to match against outside Captain's Mode. `ban_ocr.py`
reads that text region with Tesseract and fuzzy-matches each extracted
name against the real hero list, so a minor OCR misread (e.g. a smudged
character) still resolves correctly rather than silently failing.

## Why picks use ORB feature matching, not template matching

Started with plain `cv2.matchTemplate` pixel matching, which real
ground-truth testing (an actual screenshot with two confirmed picks —
Lion and Lina) showed failing badly: both correct heroes scored near
zero and ranked outside the top 20 of 125, even with the right reference
images. Root cause: Dota's in-game draft-slot portrait is cropped/zoomed
differently than Valve's CDN reference image of the same hero, and raw
pixel matching is too sensitive to that kind of scale/crop mismatch even
between genuinely matching images. Switched to ORB (feature/keypoint
matching, built for exactly "same subject, different scale/crop") and
verified decisively on the same ground truth: Lion ranked #1 with 142
good keypoint matches (next-best: 1), Lina #1 with 10 (next-best: 2),
and every confirmed-empty slot scored 0 against all 125 heroes. See
`matcher.py`'s docstring.

One known gap this doesn't handle: a player using a non-default cosmetic
hero skin will look different from the default-appearance reference
image, which could hurt matching for that specific pick. Not yet
addressed — worth revisiting if it turns out to be common enough to
matter in practice.

## Calibration

`regions.py` stores coordinates as percentages of the **Dota 2 game
window itself** (found by window title via `window_capture.py`, not
"whatever's on monitor 1") — so one correct calibration works for every
user's setup automatically: any monitor count/arrangement, windowed or
borderless, any resolution. This is a one-time fix to the shipped
defaults, not a per-user setup step.

`PICK_SLOTS` was measured directly, pixel-by-pixel, from a real
2560x1440 Ranked All Pick capture — all 10 portrait boxes verified to
land correctly, and end-to-end detection verified against real,
user-confirmed ground truth (see above). `BAN_LOG_REGION` was set
generously around the real ban text log from that same capture (OCR
tolerates an imprecise crop far better than icon matching does).

If detection seems off on a different setup (different aspect ratio,
changed Dota's HUD scale slider, etc.), re-run (from source, not the
.exe — this is a dev/debugging tool):

```bash
python calibrate.py
```

3 seconds to switch to a Dota 2 draft screen (any mode; a bot lobby is
the easiest way to get one on demand), then it saves:

- `calibration_grid.png` — the captured window with a labeled 5% grid
- `regions_preview.png` — red boxes over each pick slot + a cyan box
  over the ban-log region, from the current `regions.py`

Check `regions_preview.png` against the real portraits/log position; if
off, read correct percentages off `calibration_grid.png` and update
`regions.py`.

If Dota is running in true exclusive fullscreen (not Borderless
Windowed), the capture may come back black — Windows' desktop capture
APIs generally don't see into exclusive-fullscreen surfaces. Borderless
Windowed avoids this and is the recommended display mode regardless.

## How it fits into the Draft Helper

Polls the backend's existing `/api/draft/state` every 2s and stays idle
until a draft is detected (reusing GSI's phase/timer signal, which works
fine even in All Pick — it's only the pick/ban *content* Valve blanks,
not the phase timing). Once active, it scans the screen every second and
posts results to `/api/draft/screen-report`, which merges into the same
draft state GSI feeds — the Draft Helper page doesn't need to know which
source a pick or ban came from. Picks and bans only ever accumulate
within a draft (never un-reported), since both are permanent once they
happen — protects against a single flaky OCR/match pass regressing
already-confirmed state.

## Accuracy notes

- Pick matching requires at least 5 good ORB keypoint matches
  (`matcher.py`'s `MIN_GOOD_MATCHES`) — tuned against real ground truth
  where the weaker of two genuine picks scored 10 and every empty/wrong
  comparison scored 0-2.
- Ban OCR fuzzy-match cutoff is 0.75 similarity (`ban_ocr.py`).
- Both are tuned to prefer missing a pick/ban over reporting a wrong
  one.
- Needs a consistent, unobstructed capture of the draft screen — a
  window on top of Dota, or in-game overlays covering the pick strip or
  chat log, will reduce accuracy.
