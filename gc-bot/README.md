# GC bot

Resolves `cluster`/`replaySalt` for arbitrary Dota 2 match IDs via a live
Steam/Dota 2 Game Coordinator session. Built after empirically testing (see
[`../research/README.md`](../research/README.md)) that neither OpenDota's
free API nor Stratz reliably has this for matches nobody has specifically
looked up — 1/40 and 0/10 hit rates respectively in real, live tests. A
logged-in GC session can resolve any valid match ID directly from Valve,
which is the same technique OpenDota's own "Retriever" service and every
other third-party Dota stats site is built on.

Everything downstream of getting `cluster`/`replaySalt` — downloading the
replay from Valve's CDN, parsing it, extracting features — already exists
elsewhere in this repo (`backend/services/vitals_parser.py` and friends).
This service only replaces the "how do we get cluster/replaySalt for a
match nobody asked about" step.

## Requires a dedicated Steam account

Not your main account — a spare one with Dota 2 in its library. Running an
automated login like this sits in a gray area of Steam's ToS; it's the
de facto standard the entire Dota stats ecosystem runs on (Valve has
tolerated it for years), but a disposable account is the right way to do
it, not a personal one.

## Library choice, and a disclosed tradeoff

Uses [`dota2-gc`](https://www.npmjs.com/package/dota2-gc) (built on the
actively-maintained `steam-user`), not the older `dota2` npm package —
that one depends on the unmaintained `steam` client library and is itself
marked deprecated on npm. Verified directly against `dota2-gc`'s installed
source (not just its README) that `client.match.getDetails()` maps
`cluster`/`replaySalt` straight from the real GC response.

**Known, accepted risk**: `dota2-gc`'s dependency chain (via `steam-user`
→ `steam-appticket`) pulls in a `protobufjs` version with several
unresolved CVEs (`npm audit` reports 8 high + 1 critical, no fix
available at the time this was written). Blast radius is limited — this
service only decodes protobuf messages Steam's own GC sends back, not
arbitrary internet input, and it's never exposed outside the internal
docker network — but it's a real, disclosed tradeoff of this ecosystem,
not an oversight. Re-run `npm audit` periodically; if a fixed version
becomes available, bump it.

## Setup

1. Set `STEAM_BOT_USERNAME` / `STEAM_BOT_PASSWORD` in your deployment
   (Portainer's stack environment variables, or a `.env` file next to
   `docker-compose.yml` — **never commit these**).
2. Start the `gc_bot` container and watch its logs.
3. First login needs a Steam Guard code (unless the account has 2FA
   fully disabled, not recommended). The logs will print exactly what to
   run:
   ```bash
   curl -X POST http://<host>:3500/steamguard -H 'Content-Type: application/json' -d '{"code":"XXXXX"}'
   ```
4. Once logged in, a refresh token is saved to the `immortalplus_gcbot_data`
   volume — subsequent restarts skip the password/Steam Guard step
   entirely as long as that volume persists.

## API

- `GET /health` → `{ steamReady, gcReady, lastError }`
- `GET /resolve/:matchId` → `{ match_id, cluster, replay_salt }` on success,
  404 if the GC has no record of that match (it only keeps a short-term
  history — old matches will still 404 here, same as everywhere else), 503
  if the GC connection isn't up yet.

## Status

Built and smoke-tested against Steam's real login endpoint (confirmed the
full connection/auth pipeline works end-to-end — a bad-password attempt
correctly round-tripped a real `InvalidPassword` response from Steam).
**Not yet tested with real credentials or a real `/resolve` call** — that
needs the actual spare account's Steam Guard code submitted once, which
only the account owner can do.
