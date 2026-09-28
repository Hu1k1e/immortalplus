# draft-scanner

A small local companion app that fills the one real gap in the Draft
Helper: **Ranked All Pick (and every mode except Captain's Mode) never
exposes opponent picks/bans through any API** — not GSI, and (confirmed
via Valve's own 7.35d patch notes, which deliberately blanked this data
in response to the "OverPlus"/Overwolf controversy) not even Overwolf's
officially-sanctioned game integration. The only channel Valve hasn't
closed is reading what's already rendered to your own screen — this app
does that: screen capture + hero-icon template matching for picks, OCR
for bans (see below), no game-memory access, no process injection (same
category as OBS or Discord's screen share, not the category Valve has
warned about banning for).

Runs on your **gaming PC** (the same machine running Dota 2), not the
Docker backend — it needs real access to your monitor.

## Setup

```bash
cd draft-scanner
pip install -r requirements.txt
```

Also install the **Tesseract OCR engine** (a separate binary — the
`pytesseract` package is just a Python wrapper around it, and bans are
read via OCR, not icon matching — see "Why bans use OCR" below):

- Windows: https://github.com/UB-Mannheim/tesseract/wiki (installer),
  or `choco install tesseract` from an elevated shell.
- Confirm it's on PATH: `tesseract --version`. If you installed it
  somewhere pytesseract can't find automatically, set
  `pytesseract.pytesseract.tesseract_cmd` at the top of `ban_ocr.py` to
  its full exe path.

Set `IMMORTALPLUS_BACKEND_URL` if your backend isn't at the default
(`https://dota.hulksmash.ca`) — see `config.py`.

## Why bans use OCR, not icon matching

Picks render as hero portraits (template matching works great). Bans
don't — Ranked All Pick's auto-bans show up as plain scrolling text in
the chat/log panel ("Phantom Assassin has been Banned."), confirmed
directly from a real capture. There's no ban icon strip to match against
outside Captain's Mode. `ban_ocr.py` reads that text region with
Tesseract and fuzzy-matches each extracted name against the real hero
list, so a minor OCR misread (e.g. a smudged character) still resolves
correctly rather than silently failing.

## Calibration

`regions.py` stores coordinates as percentages of the **Dota 2 game
window itself** (found by window title via `window_capture.py`, not
"whatever's on monitor 1") — so one correct calibration works for every
user's setup automatically: any monitor count/arrangement, windowed or
borderless, any resolution. This is a one-time fix to the shipped
defaults, not a per-user setup step.

`PICK_SLOTS` was measured directly, pixel-by-pixel, from a real
2560x1440 Ranked All Pick capture — all 10 portrait boxes verified to
land correctly. `BAN_LOG_REGION` was set generously around the real ban
text log from that same capture (OCR tolerates an imprecise crop far
better than icon matching does).

If detection seems off on your setup (different aspect ratio, changed
Dota's HUD scale slider, etc.), re-run:

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

## Running

```bash
python main.py
```

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

- Pick confidence threshold defaults to 0.75 (`config.py`) — tuned to
  prefer missing a pick over reporting a wrong one.
- Ban OCR fuzzy-match cutoff is 0.75 similarity (`ban_ocr.py`) — same
  philosophy.
- Needs a consistent, unobstructed capture of the draft screen — a
  window on top of Dota, or in-game overlays covering the pick strip or
  chat log, will reduce accuracy.
