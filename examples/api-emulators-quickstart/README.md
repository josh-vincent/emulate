# API Emulators Quickstart

Runnable, narrated end-to-end demos for **every** `emulate` emulator — all 16
direct providers, the Nango provider library, and three comprehensive
3-month operational simulations with full endpoint coverage.

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

# The three 3-month simulations (full route coverage, assertion-gated)
pnpm --filter api-emulators-quickstart sims

# Everything
pnpm --filter api-emulators-quickstart all
```

## Quickstarts

Concise (~4–6 narrated steps) demos representative of each provider.

| Script | Provider | Flow exercised |
| --- | --- | --- |
| `vercel` | Vercel | token auth → projects / deployments |
| `github` | GitHub | token auth → repos / issues |
| `google` | Google | OIDC authorize → token → userinfo + JWKS |
| `slack` | Slack | token auth → `chat.postMessage` / history |
| `apple` | Apple | authorize → token → decode signed `id_token` (JWKS) |
| `microsoft` | Microsoft Entra | OIDC authorize → token → Graph `/me` |
| `okta` | Okta | OIDC (custom auth server) → token → SSWS mgmt API |
| `aws` | AWS | S3 put/get (XML) + SQS send/receive (form) |
| `resend` | Resend | API key → send email → inbox capture |
| `stripe` | Stripe | products/prices → checkout session → payment intent |
| `mongoatlas` | MongoDB Atlas | API key → clusters / database users |
| `clerk` | Clerk | OIDC sign-in → userinfo → Backend API (secret key) |
| `workos` | WorkOS | authorize → authenticate → memberships → password grant |
| `nango` | Nango | connections → records → proxy → connect-session handshake |
| `nango-providers` | Nango ×34 | loads `../nango-seeds.yaml`, one provider per category |

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

## 3-month simulations (full endpoint coverage)

These simulate a quarter of operations and then drive **every** route the
emulator registers, asserting 100 % route-pattern coverage. They exit non-zero
on any coverage gap, 5xx, or list-endpoint failure — so they double as
contract tests.

| Script | What it proves |
| --- | --- |
| `uptick-sim` | 12 weekly client onboardings + defect lifecycle across 90 days; **24/24** uptick routes; round-trip verified |
| `simpro-sim` | ~30 dated jobs (+ schedules/invoices/payments) across 90 days; a generic crawler resolves every `:param` transitively and exercises **all 372** (method, path) endpoints (≥97 % 2xx, 0 × 5xx) |
| `nango-providers-sim` | 90 days of dated records for **xero, quickbooks, google-drive, onedrive**; every generic Nango route + each provider-native `/proxy/*` path (Xero envelope, QBO query, Drive `fileList`, Graph `driveItems`); **18/18** routes |

## Nango provider library

`../nango-seeds.yaml` is a 34-provider, SDK-aligned seed catalogue (Salesforce,
HubSpot, Jira, GitHub, Shopify, Zendesk, Slack, …). `nango-providers` loads it
whole and walks a representative provider per category; `nango-providers-sim`
drives four of them through a full 3-month simulation.

For **live activity streaming** (gmail / teams / drive / calendar / whatsapp
arriving in real time) see `emulate-sim` and `inbox-stream.yaml` in
[`../../packages/@emulators/simulator/`](../../packages/@emulators/simulator/).

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
  simpro.ts / uptick.ts     Deep narrated walkthroughs (+ round-trip)
  uptick-sim.ts             Uptick 3-month sim, 24/24 route coverage
  simpro-sim.ts             Simpro 3-month sim, 372/372 route coverage
  simpro-routes.generated.ts  Auto-generated simpro route table (driver input)
  nango-providers-sim.ts    Nango 4-provider 3-month sim, 18/18 route coverage
```
