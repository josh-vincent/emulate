# `@emulators/server` — deployable emulate service

Single Hono app that multiplexes all 16 emulators behind one port. Drop it on a
server, point your dev/staging app at it, and run real OAuth flows against
fake providers.

```
http://emulate.yourdomain.com/google/...      → Google emulator
http://emulate.yourdomain.com/workos/...      → WorkOS emulator
http://emulate.yourdomain.com/simpro/...      → Simpro emulator
http://emulate.yourdomain.com/_admin/...      → seed / reset / list users
...
```

---

## Run it

### Docker compose (default — port 4000)

```bash
cp emulate.config.example.yaml emulate.config.yaml   # edit users/data
docker compose up -d --build
curl http://localhost:4000/_admin/health
```

### Bare node

```bash
PORT=4000 \
EMULATE_BASE_URL=http://localhost:4000 \
EMULATE_CONFIG_PATH=$PWD/emulate.config.yaml \
node apps/server/dist/index.js
```

### Env vars

| Var | Purpose | Default |
|---|---|---|
| `PORT` | Listen port | `4000` |
| `EMULATE_BASE_URL` | Public URL emitted in OIDC issuers / redirects | `http://localhost:4000` |
| `EMULATE_CONFIG_PATH` | YAML config path | auto-discover |
| `EMULATE_CONFIG_URL` | Fetch config over HTTP at boot | — |
| `EMULATE_ADMIN_TOKEN` | Bearer required on `/_admin/*` (except `/health`) | unset = open |

---

## Admin API

```bash
GET  /_admin/health               # liveness, lists mounted services
GET  /_admin/users                # unified roster + minted bearer tokens
GET  /_admin/config               # current config snapshot
POST /_admin/reset                # wipe all stores (keeps default seed)
POST /_admin/seed     {body: EmulateConfig}              # full reseed (wipe + apply)
POST /_admin/seed?mode=merge  {body: EmulateConfig}      # additive upsert (no wipe)
GET  /_admin/export   [?service=&format=yaml|json&includeCredentials=true]
```

When `EMULATE_ADMIN_TOKEN` is set, all routes except `/health` require
`Authorization: Bearer <token>`.

### Seed: replace vs. merge

`emulate` is a primitive — the consuming project pushes *its own* seed and
owns that data. Pushing config for a service **suppresses that service's
built-in defaults** (e.g. no `testuser@gmail.com`); services with no pushed
config keep their defaults.

- **`POST /_admin/seed`** (default, `mode=replace`) — wipe and reapply. Live
  OAuth credentials issued during connect flows are preserved across the
  reseed so connected integrations don't have to re-authorise.
- **`POST /_admin/seed?mode=merge`** — additive upsert onto the running store.
  No wipe, no auth reset. Only the services present in the body are touched.
  Idempotency depends on each plugin's upsert: `simpro` / `nango` are fully
  upsert-safe; `google` calendars/events and `uptick` defects duplicate on
  repeat; `microsoft` Graph arrays are replaced wholesale.

### Export (portable, re-seedable)

`GET /_admin/export` captures live store state back into an
`EmulateConfig`-shaped payload that `POST /_admin/seed` accepts **verbatim**
(round-trip invariant) — mutate through the normal API, then export the result
as the seed for another emulator instance.

- `?service=<name>` — single service (default: all mounted)
- `?format=yaml|json` — default `json`; `yaml` is human-editable
- `?includeCredentials=true` — emit nango access/refresh tokens (default:
  stripped and re-synthesised on re-seed). `oauth_clients.client_secret` is
  always retained (static config needed to replay OAuth); the internal OAuth
  token/code collections are never exported.

State exporters exist for **`nango`, `uptick`, `google`, `simpro`, and
`microsoft`** — these round-trip exactly. Services without an exporter are
listed under `_meta.export_notes`; that envelope is inert on re-seed, so the
payload stays directly re-seedable (re-seed those services from their original
config).

```bash
BASE=http://localhost:4000 bash apps/server/scripts/test-export-roundtrip.sh
```

The full E2E test in `scripts/test-admin-seed.sh` exercises:
1. POST `/_admin/seed` with custom users + seed data
2. WorkOS platform login as the seeded user
3. Independent Gmail OAuth → fetch the seeded message
4. Independent Simpro OAuth → fetch the seeded customer + staff
5. Refresh-token rotation

```bash
BASE=http://localhost:4000 bash apps/server/scripts/test-admin-seed.sh
```

---

## Wiring a Next.js dashboard to the emulated WorkOS

The emulator implements the WorkOS User Management endpoints under
`/workos/user_management/...` and signs JWTs that match the real shape.
Point the WorkOS SDK at it and your normal sign-in flow runs unmodified.

### 1. Env vars

```bash
# .env.local
WORKOS_API_KEY=sk_test_anything                         # not validated
WORKOS_CLIENT_ID=client_test                            # any string
WORKOS_API_HOSTNAME=localhost:4000/workos               # ← override
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback
WORKOS_COOKIE_PASSWORD=at-least-32-random-chars-required
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

### 2. SDK init (with `fetch` rewrite — works on plain HTTP)

```ts
// lib/workos.ts
import { WorkOS } from "@workos-inc/node";

export const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
  // The SDK builds https://api.workos.com/... URLs. Rewrite at fetch level
  // so we can run the emulator on plain HTTP without TLS.
  fetchFn: (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const rewritten = url.replace(
      /^https:\/\/api\.workos\.com/,
      "http://localhost:4000/workos",
    );
    return fetch(rewritten, init);
  },
});
```

### 3. AuthKit users — set up Caddy for HTTPS

`@workos-inc/authkit-nextjs` enforces HTTPS. Front the emulator with Caddy:

```caddy
# Caddyfile
emulate.localhost {
  reverse_proxy localhost:4000
  tls internal
}
```

```bash
caddy run --config Caddyfile
# then in .env.local:
WORKOS_API_HOSTNAME=emulate.localhost/workos
```

Caddy installs its own root CA on macOS — `curl https://emulate.localhost/_admin/health`
will work without `-k`.

### 4. Seed users

```bash
curl -X POST http://localhost:4000/_admin/seed \
  -H 'content-type: application/json' \
  -d '{
    "users": [
      { "id": "alice", "role": "admin", "email": "alice@acme.test", "name": "Alice Admin",
        "providers": { "workos": true, "google": { "gmail": true }, "simpro": { "staff": true, "admin": true } } }
    ]
  }'
```

Each user gets default password `Password123!` and membership in
`org_emulate-org` so password login + authorization-code flow both work.

---

## Cookie pitfalls (and how this setup avoids them)

We hit a wall here last time. Notes for next time:

### Symptom: "session cookie is set but request to `/api/auth/me` shows
`undefined`" / login loop / cookie doesn't appear in dev tools.

### Cause matrix

| Cause | Why it bit us | How to avoid with the emulator |
|---|---|---|
| **`Secure` cookie on plain HTTP** | AuthKit sets `Secure: true` by default. Browsers silently drop `Secure` cookies on `http://` origins. | Either run the dashboard on HTTPS too (`mkcert localhost` or Caddy `tls internal`), **or** force `cookieOptions.secure = false` in dev. |
| **Cross-port `SameSite=Lax`** | Dashboard on `:3000`, emulator on `:4000`. The auth code lands on `:3000`, which is fine for `SameSite=Lax`, **but** if any iframe/`fetch` from `:4000` writes a cookie back, the browser blocks it. | Keep cookies set by the **dashboard** only — never by the emulator. The emulator's job is to redirect with `?code=...`; the dashboard exchanges the code and writes its own session cookie on its own origin. |
| **`SameSite=None` without `Secure`** | If you flip to `SameSite=None` to support cross-origin, browsers require `Secure`, which requires HTTPS, which back to row 1. | Don't use `SameSite=None`. Stay on `Lax` and keep all session cookies on the dashboard origin. |
| **Cookie domain mismatch** | `domain=.yourdomain.com` cookies don't apply on `localhost`. | Omit `domain` entirely in dev — defaults to the request host. |
| **Subdomain split (`app.localhost` ↔ `emulate.localhost`)** | Different eTLD+1 entries — cookies don't share. | Same as above: only the **dashboard** writes the session cookie. |
| **Stale `wos-session` after a reseed** | Seeded user IDs change → cookie references a user that no longer exists → AuthKit silently 401s. | After `POST /_admin/seed`, clear cookies for the dashboard origin (or use a pinned `id` in the config so user IDs are stable). |
| **`__Host-` prefix** | `__Host-foo` cookies require `Secure` + `Path=/` + no `domain` — fail on plain HTTP. | If a library uses `__Host-` cookies, you **must** run dev on HTTPS. AuthKit's session cookie isn't `__Host-` prefixed by default. |

### Recommended local layout

The combination that worked end-to-end without cookie weirdness:

```
http://localhost:3000          ← Next.js dashboard (writes session cookies)
http://localhost:4000          ← emulate-server (no cookies, just redirects + JSON)
```

Why it works:
- Auth callback (`/api/auth/callback?code=...`) is a `Lax` top-level
  navigation back to the dashboard origin — cookies set in that response
  are accepted.
- All subsequent dashboard ↔ emulator calls are server-to-server (Next.js
  route handlers using `fetch`) and don't involve the browser's cookie jar.
- The emulator never sets cookies the browser needs to keep — it returns
  302s with `?code=...` plus JSON token bodies.

### If you must use HTTPS everywhere

1. `caddy run` with the Caddyfile above.
2. Set `WORKOS_API_HOSTNAME=emulate.localhost/workos`.
3. Run the dashboard on `https://app.localhost` (Caddy can proxy `:3000`
   too).
4. Cookies now work with default `Secure` + `SameSite=Lax`. No SDK
   changes needed.

### Debugging checklist when cookies vanish

```bash
# 1. Confirm the dashboard set the cookie:
curl -i -c /tmp/jar.txt http://localhost:3000/api/auth/callback?code=...
grep -i set-cookie /tmp/jar.txt

# 2. Confirm the emulator's redirect didn't try to set cookies:
curl -i "http://localhost:4000/workos/user_management/authorize?client_id=client_test&redirect_uri=http://localhost:3000/cb"
# should be a 302 only — no Set-Cookie

# 3. Confirm the user still exists post-reseed:
curl -s http://localhost:4000/_admin/users | jq '.users[].email'
```
