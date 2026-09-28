# draft-scanner

A small local companion app that fills the one real gap in the Draft
Helper: **Ranked All Pick (and every mode except Captain's Mode) never
exposes opponent picks/bans through any API** — not GSI, and (confirmed
via Valve's own 7.35d patch notes, which deliberately blanked this data
in response to the "OverPlus"/Overwolf controversy) not even Overwolf's
officially-sanctioned game integration. The only channel Valve hasn't
closed is reading what's already rendered to your own screen — this app
does that: screen capture + hero-icon template matching, no game-memory
access, no process injection (same category as OBS or Discord's screen
share, not the category Valve has warned about banning for).

Runs on your **gaming PC** (the same machine running Dota 2), not the
Docker backend — it needs real access to your monitor.

## Setup

```bash
cd draft-scanner
pip install -r requirements.txt
```

Set `IMMORTALPLUS_BACKEND_URL` if your backend isn't at the default
(`https://dota.hulksmash.ca`) — see `config.py`.

## Calibration

`regions.py` stores slot coordinates as percentages of the **Dota 2
game window itself** (found by window title via `window_capture.py`,
not "whatever's on monitor 1") — so one correct calibration works for
every user's setup automatically: any monitor count/arrangement,
windowed or borderless, any resolution. This is a one-time fix to the
shipped defaults, not a per-user setup step — most people running this
never need to touch `calibrate.py` at all.

It's currently a best-effort placeholder, **not yet verified against a
real screenshot**. To fix it for real:

```bash
python calibrate.py
```

This gives you 3 seconds to switch to a Dota 2 draft screen (any mode —
Captain's Mode works fine for calibration even though we don't need the
scanner there; a bot lobby is the easiest way to get one on demand),
then saves:

- `calibration_grid.png` — the captured window with a labeled 5% grid
- `regions_preview.png` — red boxes showing where `regions.py` currently
  thinks each hero portrait slot is

Check `regions_preview.png`: if the boxes don't land exactly on each
hero portrait, read the correct percentages off `calibration_grid.png`
and update `PICK_SLOTS`/`BAN_SLOTS` in `regions.py`, then re-run
`calibrate.py` to confirm. (Or just send both PNGs back and the exact
coordinates can be set directly from them.)

If Dota is running in true exclusive fullscreen (not Borderless
Windowed), the capture may come back black — Windows' desktop capture
APIs generally don't see into exclusive-fullscreen surfaces. Borderless
Windowed avoids this and is the recommended display mode regardless.

One real limitation this doesn't solve: if a user changes Dota's own
HUD/interface scale slider away from default, the draft HUD's position
within the window can shift slightly, which calibrating from one
person's screen won't catch. Acceptable for v1 — worth revisiting if it
turns out to be common.

## Running

```bash
python main.py
```

It polls the backend's existing `/api/draft/state` every 2s and stays
idle until a draft is detected (reusing GSI's phase/timer signal, which
works fine even in All Pick — it's only the pick/ban *content* Valve
blanks, not the phase timing). Once active, it captures the screen every
second, identifies hero portraits via template matching, and posts
results to `/api/draft/screen-report`, which merges into the same draft
state GSI feeds — the Draft Helper page doesn't need to know which
source a pick came from.

## Accuracy notes

- Confidence threshold defaults to 0.75 (`config.py`) — tuned to prefer
  missing a pick over reporting a wrong one.
- Needs a consistent, unobstructed capture of the draft screen — a
  window on top of Dota, or in-game overlays covering the pick strip,
  will reduce accuracy.
- Only tested against the placeholder region coordinates so far — real
  accuracy depends entirely on calibration above.
