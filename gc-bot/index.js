/**
 * Resolves cluster/replaySalt for arbitrary Dota 2 match IDs via a live
 * Game Coordinator session — the piece OpenDota/Stratz can't reliably give
 * us for matches nobody has specifically indexed (see research/README.md
 * for the empirical tests that established this). Everything downstream
 * (replay download, parsing, feature extraction) already exists elsewhere
 * in this repo; this service only replaces the "how do we get cluster/
 * replaySalt" step.
 *
 * Uses dota2-gc (built on the actively-maintained steam-user, unlike the
 * older/deprecated `dota2` npm package which depends on the unmaintained
 * `steam` client) — verified directly against its installed source that
 * MatchHandler.getDetails() maps `cluster`/`replaySalt` straight from the
 * real GC response (raw.cluster / raw.replay_salt).
 *
 * Known accepted risk: dota2-gc's dependency chain (via steam-user ->
 * steam-appticket) pulls in a protobufjs version with unresolved (no fix
 * available) CVEs at the time this was written. Blast radius is limited —
 * this service only processes protobuf messages Steam's own GC sends us,
 * not arbitrary internet input, and it's never exposed outside the
 * internal docker network — but it's a real, disclosed tradeoff of using
 * this ecosystem, not an oversight.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Dota2Client } = require('dota2-gc');
// Not re-exported from the package's public index (its package.json
// "exports" map only allows ".", so a plain require('dota2-gc/dist/...')
// is blocked by Node itself, not just convention) — dota2-gc's own
// login() calls this internally before doing anything else (confirmed
// directly in its source, Dota2Client.js) but our token-based path below
// replicates that method's other steps without this one, which is
// exactly why it was crash-looping in production ("Protos not loaded.
// Call loadProtos() first.", thrown from sendToGC/startGCConnection).
// require.resolve() finds the real on-disk path Node already resolved
// the main entry to; requiring THAT absolute path (unlike a package
// specifier) isn't subject to the exports map at all.
const dota2GcCjsDir = path.dirname(require.resolve('dota2-gc'));
const { loadProtos } = require(path.join(dota2GcCjsDir, 'utils', 'proto-loader.js'));

const PORT = process.env.PORT || 3500;
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const TOKEN_PATH = path.join(DATA_DIR, 'refresh_token.txt');

const ACCOUNT_NAME = process.env.STEAM_BOT_USERNAME;
const PASSWORD = process.env.STEAM_BOT_PASSWORD;

if (!ACCOUNT_NAME || !PASSWORD) {
  console.error('STEAM_BOT_USERNAME and STEAM_BOT_PASSWORD must both be set.');
  process.exit(1);
}

const client = new Dota2Client();
let pendingGuardCallback = null;
let lastError = null;

client.on('steamGuard', (domain, callback, lastCodeWrong) => {
  console.log(`[STEAM GUARD] Code needed (domain=${domain || 'mobile/email authenticator'}, lastCodeWrong=${lastCodeWrong}).`);
  console.log(`[STEAM GUARD] Submit it with:`);
  console.log(`  curl -X POST http://localhost:${PORT}/steamguard -H 'Content-Type: application/json' -d '{"code":"XXXXX"}'`);
  pendingGuardCallback = callback;
});

client.on('error', (err) => {
  lastError = err?.message || String(err);
  console.error('[ERROR]', err);
});

client.on('disconnected', (reason) => {
  console.warn('[DISCONNECTED]', reason);
});

// steam-user issues a fresh refresh token on login/renewal — persisting it
// (to a mounted volume, not into the image) lets subsequent restarts skip
// password + Steam Guard entirely. dota2-gc's login() wrapper doesn't
// expose refreshToken passthrough, so the token-based path below talks to
// the underlying steamClient directly rather than through that wrapper.
client.steamClient.on('refreshToken', (token) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, token, 'utf8');
    console.log('[AUTH] Saved refresh token — Steam Guard won\'t be needed on next restart as long as this volume persists.');
  } catch (e) {
    console.error('[AUTH] Failed to persist refresh token:', e);
  }
});

/**
 * Logs in via a saved refresh token if one exists (no Steam Guard prompt),
 * otherwise falls back to accountName/password (Steam Guard will fire).
 * The token path bypasses Dota2Client.login()'s wrapper (which only
 * accepts accountName/password) and replicates its post-login setup
 * (marking ready, launching Dota 2, starting the GC handshake) directly —
 * see the module docstring for why, and the caveat that this leans on
 * non-wrapped internals if dota2-gc's API surface changes later.
 */
async function login() {
  let savedToken = null;
  try {
    savedToken = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    // No saved token yet — first run, or the data volume was reset.
  }

  if (savedToken) {
    console.log('[AUTH] Found a saved refresh token, logging in without password/Steam Guard...');
    await loadProtos();
    await new Promise((resolve, reject) => {
      client.steamClient.once('loggedOn', () => {
        client._ready = true;
        client.steamClient.gamesPlayed([570]);
        client.startGCConnection();
        resolve();
      });
      client.steamClient.once('error', reject);
      client.steamClient.logOn({ refreshToken: savedToken });
    });
  } else {
    console.log('[AUTH] No saved token — logging in with account name/password. A Steam Guard code will likely be required (watch these logs).');
    await client.login({ accountName: ACCOUNT_NAME, password: PASSWORD, rememberPassword: true });
  }
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    steamReady: client.steamReady,
    gcReady: client.ready,
    lastError,
  });
});

app.post('/steamguard', (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Missing "code" in request body' });
  }
  if (!pendingGuardCallback) {
    return res.status(409).json({ error: 'No Steam Guard prompt is currently pending' });
  }
  const cb = pendingGuardCallback;
  pendingGuardCallback = null;
  cb(code);
  res.json({ status: 'submitted' });
});

app.get('/resolve/:matchId', async (req, res) => {
  const matchId = req.params.matchId;
  if (!client.ready) {
    return res.status(503).json({ error: 'GC not ready yet', steamReady: client.steamReady, gcReady: client.ready });
  }
  try {
    const match = await client.match.getDetails(matchId);
    if (!match || !match.cluster || !match.replaySalt) {
      return res.status(404).json({ error: 'GC has no resolvable cluster/replaySalt for this match (likely expired from its short-term history)', match_id: matchId });
    }
    res.json({ match_id: matchId, cluster: match.cluster, replay_salt: match.replaySalt });
  } catch (err) {
    console.error(`[RESOLVE] match ${matchId} failed:`, err?.message || err);
    res.status(502).json({ error: err?.message || String(err), match_id: matchId });
  }
});

app.listen(PORT, () => {
  console.log(`[HTTP] Listening on :${PORT}`);
});

login()
  .then(() => console.log('[AUTH] Steam login successful, waiting for GC connection...'))
  .catch((err) => {
    console.error('[AUTH] Login failed:', err);
    process.exit(1);
  });

client.on('ready', () => {
  console.log('[GC] Ready — Dota 2 Game Coordinator connection established, /resolve is now live.');
});
