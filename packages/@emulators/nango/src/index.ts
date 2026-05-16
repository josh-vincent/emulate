import type { AppEnv, ServicePlugin, Store, WebhookDispatcher } from "@emulators/core";
import type { Hono } from "hono";
import { connectionRoutes } from "./routes/connections.js";
import { directHubspotRoutes } from "./routes/direct-hubspot.js";
import { proxyRoutes } from "./routes/proxy.js";
import { sessionRoutes } from "./routes/sessions.js";
import { inspectorRoutes } from "./routes/inspector.js";
import { getNangoStore } from "./store.js";
import type { NangoConnection, NangoConnectionSeed } from "./types.js";

export type { NangoStoreFacade } from "./store.js";
export { getNangoStore } from "./store.js";
export type { NangoConnection, NangoConnectionSeed } from "./types.js";

export interface NangoSeedConfig {
  connections?: NangoConnectionSeed[];
}

export function seedFromConfig(store: Store, _baseUrl: string, config: NangoSeedConfig): void {
  const ns = getNangoStore(store);
  const now = new Date().toISOString();

  for (const seed of config.connections ?? []) {
    const existing = ns.getConnection(seed.id);
    if (existing) continue; // Skip duplicates

    const accessToken = seed.credentials?.access_token ?? `emulator-token-${seed.id}`;
    const refreshToken = seed.credentials?.refresh_token ?? `emulator-refresh-${seed.id}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const conn: NangoConnection = {
      id: seed.id,
      connection_id: seed.id,
      provider: seed.provider,
      provider_config_key: seed.provider_config_key,
      credentials: {
        type: "OAuth2",
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        raw: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: "Bearer",
          expires_in: 3600,
        },
      },
      connection_config: seed.connection_config ?? {},
      metadata: seed.metadata ?? {},
      created_at: now,
      updated_at: now,
      last_fetched_at: now,
    };
    ns.upsertConnection(conn);

    // Seed records per model
    for (const [model, rows] of Object.entries(seed.records ?? {})) {
      ns.setRecords(seed.id, model, rows);
    }
  }
}

/**
 * Project live Nango state back into the `NangoSeedConfig` shape. Round-trips
 * through `seedFromConfig`. Credentials (access/refresh tokens) are stripped by
 * default — `seedFromConfig` re-synthesises deterministic `emulator-token-*`
 * values on replay. Timestamps are intentionally dropped (regenerated on seed).
 */
export function storeToSeedConfig(
  store: Store,
  _baseUrl: string,
  opts?: { includeCredentials?: boolean },
): NangoSeedConfig {
  const ns = getNangoStore(store);
  const connections: NangoConnectionSeed[] = [];

  for (const conn of ns.listConnections()) {
    const seed: NangoConnectionSeed = {
      id: conn.id,
      provider: conn.provider,
      provider_config_key: conn.provider_config_key,
    };
    if (Object.keys(conn.connection_config ?? {}).length > 0) {
      seed.connection_config = conn.connection_config;
    }
    if (Object.keys(conn.metadata ?? {}).length > 0) {
      seed.metadata = conn.metadata;
    }
    if (opts?.includeCredentials) {
      seed.credentials = {
        access_token: conn.credentials.access_token,
        refresh_token: conn.credentials.refresh_token,
      };
    }
    const records = ns.allRecordsForConnection(conn.id);
    if (Object.keys(records).length > 0) {
      seed.records = records;
    }
    connections.push(seed);
  }

  return { connections };
}

export const nangoPlugin: ServicePlugin = {
  name: "nango",

  register(app: Hono<AppEnv>, store: Store, _webhooks: WebhookDispatcher, baseUrl: string): void {
    const ns = getNangoStore(store);

    app.get("/health", (c) => c.json({ ok: true }));

    inspectorRoutes({ app, store, webhooks: _webhooks, baseUrl });
    connectionRoutes(app, ns);
    sessionRoutes(app, baseUrl, ns);
    proxyRoutes(app, ns);
    directHubspotRoutes(app, store);
  },

  seed(_store: Store, _baseUrl: string): void {
    // No default seed — connections are config-driven
  },
};
