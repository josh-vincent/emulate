# API Emulators Quickstart

Runnable, narrated end-to-end demos for the **Nango**, **Simpro** and **Uptick**
emulators from `emulate`.

Each script mounts one emulator in-process — no ports, no Docker, no network —
seeds it with realistic data, then walks the full integration flow a backend
would actually run, printing each request and response the way you'd inspect it
in a REST client.

## Getting started

From the repository root:

```bash
pnpm install
pnpm --filter api-emulators-quickstart nango
pnpm --filter api-emulators-quickstart simpro
pnpm --filter api-emulators-quickstart uptick
```

Or run all three back to back:

```bash
pnpm --filter api-emulators-quickstart all
```

## What each demo covers

### `nango` — org-wide integration management

The flow a backend uses to manage many linked SaaS accounts through one Nango
account: list/fetch connections, merge sync state into connection metadata, pull
normalised records out of the sync API, proxy a provider-native QuickBooks
query, then run the hosted connect-session handshake to materialise a new
connection.

### `simpro` — field-service job management

The Simpro OAuth 2.0 authorization-code flow (`/oauth/authorize` → `code` →
`/oauth/token`) followed by the company-scoped REST surface (companies, jobs,
customers) and a webhook subscription — where the signing `Secret` is returned
exactly once on creation and omitted from every subsequent list.

### `uptick` — asset & defect management

The Uptick OAuth 2.0 password grant followed by the JSON:API resource surface:
list clients and assets, then raise a defect against a seeded asset where the
property and client are auto-resolved from the asset relationship.

## How it works

Every emulator is a `ServicePlugin` registered onto a [Hono](https://hono.dev)
app backed by an in-memory `Store` — exactly how `@emulators/server` mounts
them, but in-process so the demos run with zero setup. The shared
`src/harness.ts` provides the tiny bootstrap (`mount`) and the request/print
helper (`call`).

## Project structure

```
src/
  harness.ts    Shared in-process mount + request/print helpers
  nango.ts      Nango org-wide connection management demo
  simpro.ts     Simpro OAuth + REST + webhook demo
  uptick.ts     Uptick OAuth + JSON:API resource demo
```
