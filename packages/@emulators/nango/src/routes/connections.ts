import type { AppEnv } from "@emulators/core";
import type { Context, Hono } from "hono";
import type { NangoStoreFacade } from "../store.js";
import type { NangoConnection } from "../types.js";

export function connectionRoutes(app: Hono<AppEnv>, ns: NangoStoreFacade): void {
  // GET /connections/:connectionId — fetch connection with credentials
  // Supports ?force_refresh=true (refresh regardless of expiry)
  // Auto-refreshes if expires_at is in the past (matches real Nango behaviour)
  app.get("/connections/:connectionId", (c) => {
    const id = c.req.param("connectionId");
    let conn = ns.getConnection(id);
    if (!conn) {
      return c.json({ error: "Connection not found", connection_id: id }, 404);
    }

    const forceRefresh = c.req.query("force_refresh") === "true";
    const isExpired =
      conn.credentials.expires_at
        ? new Date(conn.credentials.expires_at).getTime() <= Date.now()
        : false;

    if (forceRefresh || isExpired) {
      conn = ns.refreshCredentials(id) ?? conn;
    }

    // Always update last_fetched_at
    conn.last_fetched_at = new Date().toISOString();

    return c.json(conn);
  });

  // GET /connection — list connections (Nango uses both /connection and /connections)
  app.get("/connection", (c) => {
    const providerConfigKey = c.req.query("provider_config_key");
    const conns = ns.listConnections(providerConfigKey);
    return c.json({ connections: conns });
  });

  // POST /connection — create or register a connection
  app.post("/connection", async (c) => {
    const body = await c.req.json<{
      connection_id: string;
      provider_config_key: string;
      credentials?: { access_token?: string; refresh_token?: string };
      connection_config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }>();

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const conn: NangoConnection = {
      id: body.connection_id,
      connection_id: body.connection_id,
      provider: body.provider_config_key,
      provider_config_key: body.provider_config_key,
      credentials: {
        type: "OAuth2",
        access_token: body.credentials?.access_token ?? `emulator-token-${Date.now()}`,
        refresh_token: body.credentials?.refresh_token,
        expires_at: expiresAt,
        raw: {
          access_token: body.credentials?.access_token ?? `emulator-token-${Date.now()}`,
          token_type: "Bearer",
          expires_in: 3600,
        },
      },
      connection_config: body.connection_config ?? {},
      metadata: body.metadata ?? {},
      created_at: now,
      updated_at: now,
      last_fetched_at: now,
    };
    ns.upsertConnection(conn);
    return c.json(conn, 201);
  });

  // PUT /connection/:connectionId/metadata — update metadata
  app.put("/connection/:connectionId/metadata", async (c) => {
    const id = c.req.param("connectionId");
    const body = await c.req.json<Record<string, unknown>>();
    const found = ns.updateMetadata(id, body);
    if (!found) {
      return c.json({ error: "Connection not found", connection_id: id }, 404);
    }
    const conn = ns.getConnection(id);
    return c.json(conn);
  });

  // PATCH /connection/:connectionId/metadata — partial update (SDK uses PATCH)
  app.patch("/connection/:connectionId/metadata", async (c) => {
    const id = c.req.param("connectionId");
    const body = await c.req.json<Record<string, unknown>>();
    const found = ns.updateMetadata(id, body);
    if (!found) {
      return c.json({ error: "Connection not found", connection_id: id }, 404);
    }
    const conn = ns.getConnection(id);
    return c.json(conn);
  });

  // GET /records/?model=...&limit=... — sync records API
  // Headers: Connection-Id, Provider-Config-Key
  const recordsHandler = (c: Context<AppEnv>) => {
    const connectionId = c.req.header("Connection-Id") ?? c.req.header("connection-id");
    const providerConfigKey =
      c.req.header("Provider-Config-Key") ?? c.req.header("provider-config-key");
    const model = c.req.query("model");
    if (!connectionId || !model) {
      return c.json(
        { message: "Missing Connection-Id header or model query param" },
        400,
      );
    }
    const raw = ns.getRecords(connectionId, model, providerConfigKey ?? undefined);
    const now = new Date().toISOString();
    const records = raw.map((row, idx) => ({
      ...row,
      _nango_metadata: {
        first_seen_at: now,
        last_modified_at: now,
        last_action: "ADDED" as const,
        cursor: `emu_cursor_${idx}`,
        deleted_at: null,
      },
    }));
    return c.json({ records, next_cursor: null });
  };
  app.get("/records", recordsHandler);
  app.get("/records/", recordsHandler);
}
