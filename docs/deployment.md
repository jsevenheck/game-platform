# Deployment

The platform ships as a single Docker image and runs on a Hostinger VPS via
`docker compose`. Deployment is fully automated through GitHub Actions: every
push to `main` runs CI, builds an image, and — if CI passes — deploys it.

## Pipeline overview (CI → GHCR → VPS)

Production does **not** build on the VPS. The flow is:

1. **CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs lint,
   typecheck, unit tests and E2E tests on every push and PR.
2. On a push to `main`, after the `ci` job passes, the **`publish-image`** job
   builds the production image and pushes it to GHCR tagged with the commit SHA
   and `latest`:
   - `ghcr.io/jsevenheck/game-platform:<sha>`
   - `ghcr.io/jsevenheck/game-platform:latest`
3. **Deploy** ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml))
   triggers when the CI workflow completes successfully on `main`. It injects
   `IMAGE_TAG=<sha>` plus the runtime secrets, then calls
   `hostinger/deploy-on-vps`.
4. [`docker-compose.yml`](../docker-compose.yml) pulls
   `ghcr.io/jsevenheck/game-platform:${IMAGE_TAG:-latest}` — the exact, immutable
   image built in step 2 — instead of rebuilding from source. This guarantees
   every deploy ships precisely the code that passed CI. Falls back to `:latest`
   for a manual `docker compose pull`.

### GHCR access from the VPS

The image package must be pullable from the VPS. Either:

- make the package **public**: GitHub → Packages → `game-platform` → Package
  settings → Change visibility, **or**
- run `docker login ghcr.io` once on the VPS with a token that has
  `read:packages`.

## Runtime configuration

Environment variables are documented in [`.env.example`](../.env.example). For
local development copy it to `.env`; `docker-compose.yml` loads that file with
`env_file: format: raw` so bcrypt hashes containing `$` are preserved verbatim.

In production these values are **not** read from a committed file. The deploy
workflow injects them via its `environment-variables` block (sourced from GitHub
repository secrets), which `hostinger/deploy-on-vps` writes to a `.env` next to
`docker-compose.yml` on the VPS.

### Admin console

The global admin console (`?admin=1`) is gated by three env vars. **All three**
must be set or the admin API stays disabled (returns `503`); the rest of the app
runs normally without them. See
[`server/admin.ts`](../apps/platform/server/admin.ts).

| Variable              | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `ADMIN_USERNAME`      | Admin login username                                     |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (never the plaintext)  |
| `ADMIN_JWT_SECRET`    | Secret signing admin session JWTs (≥ 32 chars)           |

Generate the values locally:

```bash
# bcrypt password hash — run from apps/platform (bcryptjs is a dependency there)
cd apps/platform
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "YOUR_PASSWORD"

# JWT secret (≥ 32 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# or: openssl rand -base64 48
```

Store the plaintext password somewhere safe — only its hash is ever persisted.
Use **different** values for local dev and production.

### Required GitHub secrets

Set these under repo **Settings → Secrets and variables → Actions**:

| Secret / variable          | Type     | Used by      | Notes                                   |
| -------------------------- | -------- | ------------ | --------------------------------------- |
| `HOSTINGER_API_KEY`        | secret   | deploy       | Hostinger VPS API key                   |
| `HOSTINGER_VM_ID`          | variable | deploy       | Target VM id (`vars`, not `secrets`)    |
| `ADMIN_USERNAME`           | secret   | deploy       | Admin login username                    |
| `ADMIN_PASSWORD_HASH`      | secret   | deploy       | bcrypt hash (production value)          |
| `ADMIN_JWT_SECRET`         | secret   | deploy       | Production JWT secret, ≥ 32 chars       |
| `GITHUB_TOKEN`             | built-in | publish-image | Provided automatically for GHCR push   |

Never commit real admin credentials. If a hash or secret leaks, rotate it:
generate a new one, update the GitHub secret, and redeploy.
