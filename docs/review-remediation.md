# Review remediation (F01–F08)

The original findings in `REVIEW_FINDINGS.txt` are retained as a historical review.
This document describes the implementation and deployment considerations for their fixes.

## Changes

- **F01 — Party ownership:** a bound socket cannot create or join another party,
  or resume a different member. Leave the current party first. Resuming the same
  identity on the same socket remains idempotent. Taking over a session from a
  second tab removes the previous socket from the party room and its socket index.
  Its later disconnect cannot disconnect the replacement member.
- **F02 — Dependency advisory:** the `shell-quote` override now resolves to a patched
  `^1.11.0` release. The lockfile was regenerated without reverting pre-existing
  dependency updates. Both the full and production audit must pass.
- **F03 — Bounded client requests:** `usePartyRequests` centralizes typed party
  requests. Connection setup and acknowledgement waiting each have a 10-second
  bound. Scope disposal settles pending promises, removes connection listeners
  and prevents late callbacks from updating an unmounted view. Requests are not
  automatically retried: a timed-out mutation may already have been applied.
  Lobby pending flags clear on failure, and the public toggle reconciles with
  authoritative party updates. Game reload and reconnect share a single resume
  path instead of maintaining an unresolved initial-resume promise.
- **F04 — Origin admission:** `allowRequest` enforces an exact Origin allowlist on
  polling and WebSocket handshakes; CORS uses the same origins. An absent Origin
  is deliberately accepted for native clients, which must still pass rate limits
  and party/game authorization. This policy is not authentication and does not
  protect against non-browser clients forging an Origin header.
- **F05 — Password CPU isolation:** bcrypt verification runs in worker threads,
  not on the gameplay event loop. At most two verifications run concurrently;
  excess requests receive generic HTTP 503 with `Retry-After: 1`, without an
  unbounded queue. Workers have a 10-second execution deadline and are terminated
  after completion/failure. Existing per-IP limits and generic credential errors
  remain. Passwords/hashes and worker error details are never logged.
- **F06 — Card accessibility:** Secret Signals includes localized visible card-type
  text and accessible names for director/revealed/final-board cards. Agent views
  do not render hidden type labels. Names also include revealed/marked state.
- **F07 — Storage failure recovery:** session writes/removals are best-effort,
  with an in-memory fallback and a localized persistence warning. Failed logout
  removal cannot resurrect a stale session in the current tab. Parsed session
  data is validated before use. If the browser cannot persist/remove data, reload
  behavior cannot be guaranteed; live gameplay/navigation still works.
- **F08 — Selected state:** lobby game buttons expose `aria-pressed`; keyboard
  activation and the existing selected-card styling remain intact.

## Deployment: required browser origins

For a directly started **production** server, set `SOCKET_ALLOWED_ORIGINS` to
comma-separated exact HTTP(S) origins, including scheme and non-default port
when applicable. Do not use wildcards, paths, trailing slashes or credentials:

```text
SOCKET_ALLOWED_ORIGINS=https://games.example.com
SOCKET_ALLOWED_ORIGINS=https://games.example.com,https://play.example.com
```

Without a production allowlist, browser socket handshakes fail closed.
HTTP health checks and native clients without an Origin remain unaffected.
The Docker Compose service defaults to the HTTPS origin of its existing Traefik
host rule (`COMPOSE_PROJECT_NAME.TRAEFIK_HOST`). Override
`SOCKET_ALLOWED_ORIGINS` when exposing additional hosts.

Development defaults allow localhost and 127.0.0.1 on ports 5173 and 3000.
For LAN/custom-port development, explicitly configure the browser's origin.
The policy does not trust `Host` or forwarded-host headers to build its allowlist.

## Test isolation

Playwright starts its own API/client on **3100 / 5273**, refuses to reuse existing
servers and configures the matching proxy/origin policy. These ports can be
changed with `E2E_API_PORT` and `E2E_CLIENT_PORT`. Standard `pnpm dev` ports are
unchanged. Two workers are the default because each multiplayer test opens
multiple browser contexts. Higher concurrency caused setup timeouts under the
local verification workload; the full 73-test suite passed with two workers.
Playwright owns and tears down its test servers; a separately running old server
on port 3000 is neither reused nor terminated.

## Regression coverage

- Party handler tests: duplicate creation, cross-party join/resume, same-identity
  resume, same-party identity switching, replacement socket room removal and
  disconnect/idle cleanup.
- Native transport tests: allowed, denied and missing origins for polling and
  WebSocket; unsafe config and spoofed origin suffixes.
- Request tests: action timeouts without retries, negative resume acknowledgement,
  connection timeout, scope disposal and late callbacks/connects.
- Persistence tests: denied/full storage, failed logout removal, malformed stored
  sessions, in-memory recovery and warning clearance.
- Worker/admin tests: valid/invalid passwords off the main event loop, bounded
  concurrency, error capacity release, generic HTTP 503 and responsive health
  requests during verification.
- Browser tests: storage-failure create/leave, keyboard-accessible selected game,
  missing toggle/launch acknowledgements, an already-applied toggle with a lost
  acknowledgement, and timed-out initial game resume followed by recovery.
- Secret Signals browser flow: director text/accessible type labels, no unrevealed
  agent labels, revealed card state, and German card labels.

Final command results are recorded in the remediation addendum in
`REVIEW_FINDINGS.txt`. Chromium and targeted functional/accessibility checks are
not full WCAG certification, cross-browser/device validation or a load test.
