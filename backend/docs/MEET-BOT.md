# Google Meet Bot — Reference

Single maintained reference for the Google Meet bot's two hardest problems:
staying off Google's bot flag (anti-detection) and joining as an authenticated
Workspace user (signed-in bots). Keep this in sync with the code it describes —
file paths and commands below are real.

Code lives under `src/bot/bot_scripts/googlemeet/`. See
[Maintaining this over time](#maintaining-this-over-time) for how to keep it
working as Google Meet's DOM and anti-bot posture change.

---

## 1. Anti-detection

Google Meet aggressively flags automated browsers. A flagged bot hits the
"You can't join this video call" interstitial or a reCAPTCHA challenge and never
reaches the meeting. Three layers keep the bot looking like a real client.

### 1a. Join-flow input

The join flow (name entry, mic/camera mute, join button) uses plain
Playwright clicks and fills — `clickHandle` / `fillField` in `join.js`
(`buildInputHelpers`), shared by both the anonymous and authenticated join
branches.

An earlier version of this layer routed input through an OS-level XTEST
mechanism (via `xdotool`) to make click events register as `isTrusted=true`
rather than the `isTrusted=false` Playwright/CDP normally produces. That
mechanism was removed — it depended on a bundled third-party module,
and independent of that, its actual purpose was making automated input
indistinguishable from a real person's for anti-detection purposes, which
isn't something to keep maintaining regardless of provenance. Section 1b
(stealth browser fingerprinting) is unrelated and unaffected.

### 1b. Stealth browser setup

- `playwright-extra` + `puppeteer-extra-plugin-stealth` is the **single source of
  truth** for the fingerprint (webdriver, plugins, `window.chrome`, WebGL vendor,
  languages). No hand-rolled `navigator`/`window` overrides — those contradict
  the plugin and create the self-inconsistent fingerprint Meet keys on.
  See `browser.js` (`buildStealthChromium`).
- The `user-agent-override` stealth evasion is **deliberately disabled**: left on
  it forces a Windows UA + Client-Hints onto our Linux Chromium, contradicting
  `navigator.userAgentData` (unspoofable) and triggering the interstitial.
- **Honest Linux UA**, with the Chrome major derived from the *live* engine
  (`browser.version()`), not hardcoded — a mismatch (e.g. UA 141 vs engine 148)
  contradicts Client-Hints and blocks the join. See `buildContextOptions`.
- **No security-bypass flags.** `--disable-web-security`,
  `--allow-running-insecure-content`, `--ignore-certificate-errors`, etc. are
  detectable and were removed. **Never** add `--use-fake-device-for-media-stream`
  (instant bot flag). The current hardened arg set is in `buildLaunchOptions`.
- Minimal context: only `permissions`, `userAgent`, `viewport:null`. No hardcoded
  locale/timezone (a fixed timezone can contradict the egress-IP geolocation).

### 1c. reCAPTCHA detection (`blocked_recaptcha`)

When Google serves a *visible* reCAPTCHA challenge, the bot classifies the
outcome as `blocked` rather than a generic timeout/rejection, so it isn't
mislabeled. See `admission.js` (detection keyed on a **visible** recaptcha
iframe — `iframe[title*="recaptcha challenge"]`, `...bframe`, `...api2/anchor` —
not a mere `/recaptcha/` frame URL, which false-fires on clean joins). The exit
reason surfaces as `blocked_recaptcha` in `index.js`'s failure classification.

### Maintaining this over time

Google periodically tightens Meet's anti-automation posture (new fingerprint
checks, stealth-plugin evasions that stop working, reCAPTCHA trigger changes).
This file and the code under `googlemeet/` are the source of truth — there is
no external upstream to sync against. When a join starts failing or getting
flagged:

1. Reproduce against a real meeting with `screenshotPath` enabled in
   `waitForAdmission` (see `admission.js`) to capture the exact failure
   surface (blocked/rejected/limbo).
2. Rule out a plain selector/timing regression in the join flow before
   suspecting the stealth/fingerprint layer.
3. Diff the actual DOM Google now serves against the selectors in
   `selectors.js` — Meet's structural attributes (`data-participant-id`,
   `jsname`, aria-labels) tend to be stable longer than CSS class names, so
   prefer those when adding new selectors.
4. Update this doc's "Anti-detection" section alongside any code change so the
   reasoning behind a selector or flag doesn't rot into a mystery for the next
   person debugging a join failure.

---

## 2. Signed-in (authenticated) bots

### Why

By default the bot joins as an **anonymous guest**: it types a name and clicks
"Ask to join", landing in the lobby until a host admits it. For **internal
Workspace meetings**, a bot signed into an org account is **auto-admitted** (no
lobby), and avoids the "this person may not be who they claim to be" warning.

The auth artifact is a **Playwright `storageState` JSON** (cookies +
localStorage), not a raw user-data dir — it captures the session explicitly and
avoids the lost-session-cookie trap. Multiple accounts are supported via a pool:
the bot selects the file by notetaker email per meeting. **When no auth is
configured or the file is missing, the bot falls back to anonymous guest.**

### Setup

**1. Generate a storageState file (headful, manual 2FA).** Run from the same
egress region/IP the bot will use (see security caveats):

```bash
cd backend
node src/bot/bot_scripts/googlemeet/generate-auth.js \
  --account notetaker@yourco.com \
  --out /secrets/auth/notetaker@yourco.com.json
```

The CLI launches a real Chromium window with the **same stealth/UA config the
bot uses**, pre-fills only the email (you type the password + complete 2FA
manually — auto-typing the password trips Google), polls until logged into Meet,
then writes the storageState JSON. Use `--force` to overwrite an existing file;
`--help` for usage.

**For an account pool**, run it once per account into a shared directory:

```bash
node src/bot/bot_scripts/googlemeet/generate-auth.js --account bot-a@yourco.com --out /secrets/auth/bot-a@yourco.com.json
node src/bot/bot_scripts/googlemeet/generate-auth.js --account bot-b@yourco.com --out /secrets/auth/bot-b@yourco.com.json
```

**2. Wire the environment.**

| Env var | Purpose |
|---|---|
| `GOOGLE_MEET_USE_AUTH` | Master toggle (`true`). A resolved + existing file is also treated as sufficient on its own. |
| `GOOGLE_AUTH_STATE_DIR` | Directory of `<email>.json` files (the pool). Bot picks `<DIR>/<MEET_NOTETAKER_EMAIL>.json`. |
| `GOOGLE_AUTH_STATE_PATH` | Explicit single file. **Wins** over the pooled `<DIR>/<email>.json` resolution. |
| `MEET_NOTETAKER_EMAIL` | The account to join as — selects the pooled file per meeting. |

```bash
export GOOGLE_MEET_USE_AUTH=true
export GOOGLE_AUTH_STATE_DIR=/secrets/auth
export MEET_NOTETAKER_EMAIL=notetaker@yourco.com
```

**Path resolution** (in `sidecar_launcher.js` `resolveGoogleAuthStatePath` and
`browser.js` `resolveAuthState`): explicit `GOOGLE_AUTH_STATE_PATH` wins; else
`<GOOGLE_AUTH_STATE_DIR>/<sanitized-email>.json`; else anonymous. The file is
attached as `contextOptions.storageState` **only if it exists**.

**K8s path:** the meeting-api sends `notetaker_email` (and optionally
`google_auth_state_path`) in the `/configure` payload
(`src/sidecar/models.py ConfigureRequest`); the supervisor exports them as
`MEET_NOTETAKER_EMAIL` / `GOOGLE_AUTH_STATE_PATH`
(`src/sidecar/bot_supervisor.py _build_env`). **Standalone path:**
`LocalBotRunner` already threads `notetaker_email` → `MEET_NOTETAKER_EMAIL`
(`src/services/local_bot_runner.py`). Both feed the same `sidecar_launcher.js`.

### How the authenticated join differs

In authenticated mode (`join.js` `joinAuthenticated`) the bot:

1. **Skips the name input** (uses the Google account identity).
2. Mutes mic + camera via the same click helpers as the anonymous path.
3. **Races three outcomes:**
   - **"Join now"** (`googleJoinNowSelectors`) → direct authenticated join.
   - **"Switch here"** (`googleSwitchHereSelectors`) → same account already in
     the call elsewhere; moves the session here.
   - **"Ask to join"** only → the cookies did **not** authenticate the session.

The selectors are locale-agnostic-first with English fallbacks (`selectors.js`).

### Session refresh / expiry — detecting a stale session

A storageState file expires (Google rotates session cookies). When it does, the
authenticated lobby shows only **"Ask to join"** instead of "Join now". The bot
detects this, **logs a distinct signal**, and **falls back to the anonymous
name-entry path** so the join still succeeds (as a guest):

```
[GoogleMeet Join] STALE_AUTH_SESSION: authenticated mode but only "Ask to join" appeared — cookies did not authenticate. Falling back to anonymous name entry.
```

Grep worker logs for `STALE_AUTH_SESSION` to find accounts whose storageState
needs regenerating. To refresh, re-run the `generate-auth` CLI with `--force` and
redeploy the file. (`browser.js` also logs when a configured auth file is missing
on disk: `auth file resolved to <path> but it does NOT exist`.)

You can confirm which mode a given run used from the launch logs:

```
[GoogleMeet Browser] AUTHENTICATED session: loading storageState from <path> (account=<email>) authenticated=true
[GoogleMeet Browser] no auth configured — joining as anonymous guest. authenticated=false
```

### Security caveats

- **storageState files hold LIVE session cookies.** Treat them like passwords.
  Keep them **out of git** (already covered by `.gitignore`: `auth.json`,
  `*.auth.json`, `secrets/auth/`). **Encrypt at rest** if stored in a DB (the repo
  has Fernet crypto at `src/api/product/token_crypto.py`).
- **Mount read-only** in the bot pod.
- **Don't store the account password** (`GOOGLE_ACCOUNT_PASSWORD` is discouraged
  in `.env.example`) — auto-typing it trips Google's bot detection. The
  `generate-auth` CLI never types the password; you do it manually.
- **Capture and run from the same egress region/IP.** A session captured in one
  geo and replayed from another is a fingerprint mismatch Google can flag.
- **Use a dedicated, org-owned notetaker account** with admin sign-off, and
  confirm it complies with Google's Terms of Service. Do not use a personal or
  employee account.
- Run the bot **headful** (Xvfb) as always — headless is flagged regardless of
  auth.

---

## Quick reference — files

| File | Role |
|---|---|
| `googlemeet/browser.js` | Stealth chromium, launch/context options, `resolveAuthState`, returns `authenticated`. |
| `googlemeet/generate-auth.js` | Headful CLI to capture a storageState JSON. |
| `googlemeet/join.js` | Join flow; `joinAuthenticated` branch + input helpers. |
| `googlemeet/selectors.js` | `googleJoinNowSelectors`, `googleSwitchHereSelectors`, etc. |
| `googlemeet/index.js` | `joinMeeting()` — reads auth options, wires `launchBrowser` + join. |
| `googlemeet/admission.js` | reCAPTCHA / `blocked` detection. |
| `sidecar_launcher.js` | Resolves the storageState path from env, forwards to `joinMeeting`. |
| `src/sidecar/models.py`, `bot_supervisor.py` | K8s path: `notetaker_email` / `google_auth_state_path` → env. |
| `src/services/local_bot_runner.py` | Standalone path: `notetaker_email` → env. |
