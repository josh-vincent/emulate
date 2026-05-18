// @emulators/native-kit — the generic "direct to source" engine.
//
// The Nango emulator speaks one uniform `/records` + `/proxy` envelope for
// every provider. This kit is the *other* shape: it turns a provider's
// SDK-aligned seed slice into a standalone `ServicePlugin` that serves each
// provider's records at the provider's OWN native REST path, behind the
// provider's own bearer-token endpoint — no Nango connection / records /
// proxy layer anywhere. One engine, spec-driven, so every seed-library
// provider gets a faithful direct-to-source emulator without 30+ hand-written
// API surfaces.
//
// A `NativeSpec` is derived (at package build time) from one provider block in
// `examples/nango-seeds.yaml`: its models, the seed rows, and — inferred from
// each row's own `url` / `self` / `*_url` field — the real native collection
// path (e.g. Salesforce `/services/data/v59.0/sobjects/Account`, SendGrid
// `/v3/marketing/contacts`). Where a row carries no native URL we fall back to
// the conventional `/<model-plural-lower>` collection.

import type { AppEnv, ServicePlugin, Store, WebhookDispatcher, TokenMap } from "@emulators/core";
import type { Context, Hono } from "hono";

export interface NativeModelSpec {
  /** Logical model name as it appears in the seed (e.g. "Account"). */
  model: string;
  /** Native collection path, leading slash, no id (e.g. "/v3/marketing/contacts"). */
  collectionPath: string;
  /** Field that holds the record id (e.g. "Id", "id", "uuid", "gid"). */
  idField: string;
  /** Seed rows for this model. */
  rows: Array<Record<string, unknown>>;
}

export interface NativeSpec {
  /** Provider id, matches the seed `provider:` (e.g. "sendgrid"). */
  name: string;
  /** OAuth2 token endpoint path. Defaults to "/oauth/token". */
  tokenPath?: string;
  /** Prefix for the access/refresh token strings (e.g. "sg"). */
  tokenPrefix?: string;
  /** connection_config from the seed (instance_url, api_domain, …) — informational. */
  connectionConfig?: Record<string, unknown>;
  models: NativeModelSpec[];
}

export interface NativeSeedConfig {
  /** Replace/extend seed rows per model. */
  records?: Record<string, Array<Record<string, unknown>>>;
}

const dataKey = (name: string, model: string): string => `${name}.${model}`;

type Bucket = Map<string, Record<string, unknown>>;

const bucket = (store: Store, name: string, model: string): Bucket => {
  const k = dataKey(name, model);
  let m = store.getData<Bucket>(k);
  if (!m) {
    m = new Map();
    store.setData(k, m);
  }
  return m;
};

const seqKey = (name: string): string => `${name}.__seq`;
const nextId = (store: Store, name: string): string => {
  const n = (store.getData<number>(seqKey(name)) ?? 0) + 1;
  store.setData(seqKey(name), n);
  return String(n);
};

/** Read the id off a row given a model's id field, tolerating string/number. */
const rowId = (row: Record<string, unknown>, idField: string): string | null => {
  const v = row[idField];
  if (v === undefined || v === null) return null;
  return String(v);
};

/** Native APIs are bearer-gated; only the token's presence is enforced. */
const authed = (c: Context): boolean => (c.req.header("Authorization") ?? "").toLowerCase().startsWith("bearer ");

const unauthorized = (c: Context) => c.json({ error: "unauthorized", message: "Missing or invalid bearer token" }, 401);

const notFound = (c: Context, id: string) => c.json({ error: "not_found", message: `No such resource: ${id}` }, 404);

function loadSeed(store: Store, spec: NativeSpec, models: NativeModelSpec[]): void {
  for (const m of models) {
    const b = bucket(store, spec.name, m.model);
    for (const row of m.rows) {
      const id = rowId(row, m.idField) ?? nextId(store, spec.name);
      if (!b.has(id)) b.set(id, { ...row, [m.idField]: id });
    }
  }
}

/**
 * Build a standalone direct-to-source plugin from a provider spec, plus the
 * `seedFromConfig` / `storeToSeedConfig` round-trip pair every emulate package
 * exposes. The plugin's default `seed()` loads the embedded seed slice.
 */
export function makeNativePlugin(spec: NativeSpec): {
  plugin: ServicePlugin;
  seedFromConfig: (store: Store, baseUrl: string, config: NativeSeedConfig) => void;
  storeToSeedConfig: (store: Store, baseUrl: string) => NativeSeedConfig;
} {
  const tokenPath = spec.tokenPath ?? "/oauth/token";
  const tokenPrefix = spec.tokenPrefix ?? spec.name.replace(/[^a-z0-9]/gi, "").slice(0, 4);

  const modelByPath = new Map<string, NativeModelSpec>();
  for (const m of spec.models) modelByPath.set(m.collectionPath, m);

  const seedFromConfig = (store: Store, _baseUrl: string, config: NativeSeedConfig): void => {
    const merged = spec.models.map((m) => ({
      ...m,
      rows: config.records?.[m.model] ?? m.rows,
    }));
    loadSeed(store, spec, merged);
  };

  const storeToSeedConfig = (store: Store, _baseUrl: string): NativeSeedConfig => {
    const records: Record<string, Array<Record<string, unknown>>> = {};
    for (const m of spec.models) {
      const rows = [...bucket(store, spec.name, m.model).values()];
      if (rows.length > 0) records[m.model] = rows;
    }
    return { records };
  };

  const plugin: ServicePlugin = {
    name: spec.name,
    register(app: Hono<AppEnv>, store: Store, _webhooks: WebhookDispatcher, _baseUrl: string, _tokenMap?: TokenMap) {
      app.get("/health", (c) => c.json({ ok: true, provider: spec.name, native: true }));

      // OAuth2 token endpoint — every grant succeeds, returns a bearer token.
      app.post(tokenPath, async (c) => {
        const params = new URLSearchParams(await c.req.text().catch(() => ""));
        const grant = params.get("grant_type") ?? "client_credentials";
        const rnd = () => Math.random().toString(16).slice(2).padEnd(24, "0").slice(0, 24);
        return c.json({
          access_token: `${tokenPrefix}_at_${rnd()}`,
          refresh_token: `${tokenPrefix}_rt_${rnd()}`,
          token_type: "bearer",
          expires_in: 3600,
          scope: params.get("scope") ?? "read write",
          grant_type: grant,
        });
      });

      for (const m of spec.models) {
        const col = m.collectionPath;

        // List collection.
        app.get(col, (c) => {
          if (!authed(c)) return unauthorized(c);
          const rows = [...bucket(store, spec.name, m.model).values()];
          const limit = Number(c.req.query("limit") ?? c.req.query("page_size") ?? 0);
          const out = limit > 0 ? rows.slice(0, limit) : rows;
          return c.json({ data: out, total: rows.length, model: m.model });
        });

        // Create.
        app.post(col, async (c) => {
          if (!authed(c)) return unauthorized(c);
          const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
          const id = rowId(body, m.idField) ?? nextId(store, spec.name);
          const row = { ...body, [m.idField]: id };
          bucket(store, spec.name, m.model).set(id, row);
          return c.json(row, 201);
        });

        // Read one.
        app.get(`${col}/:id`, (c) => {
          if (!authed(c)) return unauthorized(c);
          const id = c.req.param("id");
          const row = bucket(store, spec.name, m.model).get(id);
          if (!row) return notFound(c, id);
          return c.json(row);
        });

        // Update.
        app.patch(`${col}/:id`, async (c) => {
          if (!authed(c)) return unauthorized(c);
          const id = c.req.param("id");
          const b = bucket(store, spec.name, m.model);
          const row = b.get(id);
          if (!row) return notFound(c, id);
          const patch = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
          const next = { ...row, ...patch, [m.idField]: id };
          b.set(id, next);
          return c.json(next);
        });
        app.put(`${col}/:id`, async (c) => {
          if (!authed(c)) return unauthorized(c);
          const id = c.req.param("id");
          const b = bucket(store, spec.name, m.model);
          const row = b.get(id);
          if (!row) return notFound(c, id);
          const patch = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
          const next = { ...row, ...patch, [m.idField]: id };
          b.set(id, next);
          return c.json(next);
        });

        // Delete.
        app.delete(`${col}/:id`, (c) => {
          if (!authed(c)) return unauthorized(c);
          const id = c.req.param("id");
          const b = bucket(store, spec.name, m.model);
          if (!b.has(id)) return notFound(c, id);
          b.delete(id);
          return c.body(null, 204);
        });
      }
    },
    seed(store: Store, _baseUrl: string) {
      loadSeed(store, spec, spec.models);
    },
  };

  return { plugin, seedFromConfig, storeToSeedConfig };
}
