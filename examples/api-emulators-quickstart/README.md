# API Emulators Quickstart

Runnable, narrated end-to-end demos for **every** `emulate` emulator — all 16
direct providers, the Nango provider library, and five comprehensive
operational simulations / end-to-end chains with full endpoint coverage.

Each script mounts one emulator in-process — no ports, no Docker, no network —
seeds it with realistic data, then walks the integration flow a backend would
actually run, printing each request and response the way you'd inspect it in a
REST client.

## Getting started

From the repository root:

```bash
pnpm install

# A single provider
pnpm --filter api-emulators-quickstart github
pnpm --filter api-emulators-quickstart simpro

# All 13 OAuth/API direct quickstarts back to back
pnpm --filter api-emulators-quickstart direct

# The Nango provider-library walkthrough (34-provider seed catalogue)
pnpm --filter api-emulators-quickstart nango-providers

# The five simulations / e2e chains (full route coverage, assertion-gated)
pnpm --filter api-emulators-quickstart sims

# Realtime streaming — live events from one and many providers
pnpm --filter api-emulators-quickstart realtime-stream

# The end-to-end proof: a separate process auths over real HTTP through a
# running emulate server (needs `pnpm -w build` first)
pnpm --filter api-emulators-quickstart external-consumer

# Everything
pnpm --filter api-emulators-quickstart all
```

## Quickstarts

Concise (~4–6 narrated steps) demos representative of each provider.

| Script            | Provider             | Flow exercised                                                        |
| ----------------- | -------------------- | --------------------------------------------------------------------- |
| `vercel`          | Vercel               | token auth → projects / deployments                                   |
| `github`          | GitHub               | token auth → repos / issues                                           |
| `google`          | Google               | OIDC authorize → token → userinfo + JWKS                              |
| `slack`           | Slack                | token auth → `chat.postMessage` / history                             |
| `apple`           | Apple                | authorize → token → decode signed `id_token` (JWKS)                   |
| `microsoft`       | Microsoft Entra      | OIDC authorize → token → Graph `/me`                                  |
| `okta`            | Okta                 | OIDC (custom auth server) → token → SSWS mgmt API                     |
| `aws`             | AWS                  | S3 put/get (XML) + SQS send/receive (form)                            |
| `resend`          | Resend               | API key → send email → inbox capture                                  |
| `stripe`          | Stripe               | products/prices → checkout session → payment intent                   |
| `mongoatlas`      | MongoDB Atlas        | API key → clusters / database users                                   |
| `clerk`           | Clerk                | OIDC sign-in → userinfo → Backend API (secret key)                    |
| `workos`          | WorkOS               | authorize → authenticate → memberships → password grant               |
| `nango`           | Nango                | connections → records → proxy → connect-session handshake             |
| `nango-providers` | Nango ×34            | loads `../nango-seeds.yaml`, one provider per category                |
| `crm`             | HubSpot + Salesforce | OAuth → object CRUD → associations / SOQL → search / describe → batch |

## Deep walkthroughs

`simpro` and `uptick` are full narrated walkthroughs that exercise the real
provider surface end to end, including a **store → seed-config → re-seed**
round-trip that is asserted in-script:

- **`simpro`** — OAuth 2.0 auth-code + single-use refresh-token rotation,
  reference data, customers/sites/staff/contractors, jobs → sections → cost
  centers (the deepest nested route), quotes/invoices/payments/schedules/assets,
  webhook `Secret`-returned-once, inspector HTML, then a deep-route round-trip.
- **`uptick`** — OAuth 2.0 password grant, JSON:API across
  clients → properties → assets → defects with name-based FK auto-resolution,
  version-path + `page[size]` behaviour, PATCH status transitions, inspector
  tabs, then a closed-defect round-trip.

## CRM end-to-end (`crm`)

`crm` drives the two CRMs a real backend integrates first, both served by the
Nango plugin's **direct** routes (no proxy / connection layer — point a
HubSpot/Salesforce client straight at the emulator base URL):

- **HubSpot** — OAuth 2.0 authorization-code flow → create contact + company →
  v4 association → PATCH → CRM Search (`filterGroups`) → batch-create.
- **Salesforce** — OAuth 2.0 username-password grant → sObject CRUD (with the
  `attributes` envelope) → `composite/sobjects` collection-create → SOQL
  (`SELECT … FROM … WHERE …`) → sObject `describe`.

## 3-month simulations (full endpoint coverage)

These simulate a quarter of operations and then drive **every** route the
emulator registers, asserting 100 % route-pattern coverage. They exit non-zero
on any coverage gap, 5xx, or list-endpoint failure — so they double as
contract tests.

| Script                | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uptick-sim`          | 12 weekly client onboardings + defect lifecycle across 90 days; **24/24** uptick routes; round-trip verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `simpro-sim`          | ~30 dated jobs (+ schedules/invoices/payments) across 90 days; a generic crawler resolves every `:param` transitively and exercises **all 372** (method, path) endpoints (≥97 % 2xx, 0 × 5xx); **29/29** shape + relational-integrity checks (every entity's full shape + every FK resolved to a real linked record)                                                                                                                                                                                                                                                                                           |
| `nango-providers-sim` | **10 connections**, 90 days of dated records each. Four (xero, quickbooks, google-drive, onedrive) drive every provider-native `/proxy/*` path; the rest form a **cross-provider graph** — Slack/Gmail/Jira/Salesforce records link into Google Drive by file id + share URL, Jira links into GitHub PRs. **Each connection is independently verified** (resolves through the emulator, records are emulator-served, a live append round-trips back through `GET /records`, ≥75-day span), then a cross-provider integrity phase resolves **all 95** references to real linked records; **18/18** Nango routes |
| `direct-sim`          | **No Nango layer at all** — 5 emulators (GitHub, Slack, Stripe, Resend, Vercel) each spoken to through their _own_ native API. A 90-day DevOps quarter: 12 weekly cycles of incident → deploy notice → invoice payment → customer mail → service ship, then a third of incidents resolved via PATCH. Every created entity is **round-tripped back through that provider's own GET**; **24/24** native route patterns across 5 providers, **11/11** assertion checks, 0 × non-2xx                                                                                                                               |
| `business-streams`    | **Phase 2.1 — scenario-declared provider streams, zero simulator source edits.** Xero invoices, Jira issues, Salesforce opportunities, GitHub PRs and Slack messages streamed into a running Nango emulator purely from [`scenarios/business-streams.yaml`](./scenarios/business-streams.yaml) via the open generator registry; every stream's records asserted queryable through `GET /records` and each sync asserted to have fired a webhook delivery |
| `xero-quickbooks-webhooks` | **Full create → provider → signed webhook → our destination chain**, no Nango envelope. Stands up a real listening socket, registers it via `POST /webhook-settings`, then for **Xero** and **QuickBooks**: OAuth2 token → create invoice through the native write API → the emulator POSTs our destination the provider's _own_ webhook shape (Xero `events[]` under `x-xero-signature`, QuickBooks `eventNotifications[]` under `intuit-signature`), each signed **base64-HMAC-SHA256 re-derived locally and compared byte-for-byte**, then follows the webhook's resource pointer back to GET the new invoice. **11/11** assertions; both deliveries logged in `/webhook-deliveries` |

## Nango provider library

`../nango-seeds.yaml` is a 34-provider, SDK-aligned seed catalogue (Salesforce,
HubSpot, Jira, GitHub, Shopify, Zendesk, Slack, …). `nango-providers` loads it
whole and walks a representative provider per category; `nango-providers-sim`
drives a 10-connection cross-provider graph through a full 3-month simulation,
where Slack/Gmail/Jira/Salesforce records link into Google Drive files (images
and proposal/report docs) and Jira issues into resolving GitHub PRs — every
cross-reference is resolved against the target provider's real records.

## Realtime streaming

`realtime-stream` drives the published [`@emulators/simulator`](../../packages/@emulators/simulator/)
`Simulator` against an in-process Nango emulator (injected `fetch` →
`emu.app.request`, zero network), proving the _moving_ picture — new records
arriving over time exactly as a real connector feeds them. It is fully
config-driven by the scenario YAML in [`scenarios/`](./scenarios):

| Segment                      | Scenario            | Proves                                                                                                                                                                       |
| ---------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — one, realtime**        | `single-gmail.yaml` | One Gmail inbox dripping under the **real wall clock**; each message printed as it lands, then `GET /records` confirms it's queryable                                        |
| **B — many, one run**        | `all-streams.yaml`  | All **6 providers at once** (5 `sync` + WhatsApp `forward`) under a virtual clock; every stream asserted to deliver exactly its cap and every record/webhook to resolve      |
| **C — different time frame** | `quarter-drip.yaml` | A slow drip whose injected clock advances **~a quarter**; the streamed records' own timestamps are asserted to span ≥ 60 days — the time window is configurable per scenario |

Each scenario also runs unchanged against a real deployment via the published
CLI: `emulate-sim run scenarios/all-streams.yaml --base http://nango.localhost:1355`.

For the package's own example see `emulate-sim` and `inbox-stream.yaml` in
[`../../packages/@emulators/simulator/`](../../packages/@emulators/simulator/).

## External-consumer proof — point your app at emulate

Every script above mounts the emulator **in-process** for zero-setup demos.
`external-consumer` is the opposite and the whole point of `emulate`: it spawns
the real **`@emulators/server`** binary as a **separate OS process**, talks to
it only over **real HTTP**, and proves a downstream app can treat emulate as a
drop-in stand-in for the real providers — auth included.

```bash
pnpm -w build   # external-consumer runs the built server
pnpm --filter api-emulators-quickstart external-consumer
```

It walks the exact path a production OpenID Connect client runs:

1. **OIDC discovery** — `GET /google/.well-known/openid-configuration` →
   `issuer`, `jwks_uri`, `RS256`.
2. **Authorization-code flow** over HTTP → code → `POST /oauth2/token` →
   `access_token` + `id_token` + `refresh_token`.
3. **id_token verification with `jose`** — `createRemoteJWKSet(jwks_uri)` +
   `jwtVerify(id_token, JWKS, { issuer, audience })`. These are the _same
   primitives Auth.js / openid-client use internally_, so if this passes a real
   auth library trusts emulate's tokens.
4. **Token realism** — the server runs with `EMULATE_GOOGLE_TOKEN_TTL=1`, so the
   access token expires in ~1s: a stale token gets a real **401**, and the
   standard `grant_type=refresh_token` mints a fresh one that works again.
5. **Provider proxy** — an authenticated `GET /github/user` through the _same_
   running server shows emulate proxying a different provider.

### Pointing a real Auth.js app at emulate

The server's Google issuer is `http://localhost:<port>/google`. With
[Auth.js](https://authjs.dev) you only override the issuer and credentials —
**no application code changes**:

```ts
// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,        // any value in no-config mode
      clientSecret: process.env.GOOGLE_CLIENT_SECRET, // any value in no-config mode
      issuer: "http://localhost:4000/google",         // ← emulate, not accounts.google.com
    }),
  ],
});
```

Run `pnpm --filter @emulators/server dev` (defaults to `:4000`), set the env
above, and the app's normal sign-in flow — discovery, code exchange, JWKS
verification, refresh — all resolve against emulate. Shorten the token lifetime
with `EMULATE_GOOGLE_TOKEN_TTL` to exercise refresh in tests; flip
`EMULATE_AUTH_LAX=1` to disable expiry when you don't care.

## How it works

Every emulator is a `ServicePlugin` registered onto a [Hono](https://hono.dev)
app backed by an in-memory `Store` via `@emulators/core`'s `createServer` —
exactly how `@emulators/server` mounts them, but in-process so the demos run
with zero setup. The shared `src/harness.ts` provides the bootstrap (`mount`,
which also wires the same CORS + auth + rate-limit middleware) and the
request/print helper (`call`).

## Project structure

```
src/
  harness.ts                Shared in-process mount + request/print helpers
  <provider>.ts             One quickstart per direct provider (16)
  nango-providers.ts        Nango 34-provider seed-library walkthrough
  crm.ts                    HubSpot CRM + Salesforce REST/SOQL end-to-end
  simpro.ts / uptick.ts     Deep narrated walkthroughs (+ round-trip)
  uptick-sim.ts             Uptick 3-month sim, 24/24 route coverage
  simpro-sim.ts             Simpro 3-month sim, 372/372 route coverage
  simpro-routes.generated.ts  Auto-generated simpro route table (driver input)
  nango-providers-sim.ts    Nango 10-connection cross-provider 3-month sim
  direct-sim.ts             Direct (no-Nango) 5-provider native-API 3-month sim
  xero-quickbooks-webhooks.ts  Create invoice → Xero/QuickBooks → signed webhook → our destination
  realtime-stream.ts        Realtime streaming (one + many providers) via @emulators/simulator
  business-streams.ts       Phase 2.1 — Xero/Jira/Salesforce/GitHub/Slack streams, scenario-only
  external-consumer.ts      Separate-process OIDC + refresh + proxy proof over real HTTP
scenarios/
  single-gmail.yaml         One stream, realtime cadence
  all-streams.yaml          All 6 inbox providers at once, capped + deterministic
  quarter-drip.yaml         Slow drip spanning a simulated quarter
  business-streams.yaml     5 business providers (Xero/Jira/Salesforce/GitHub/Slack)
```
