import type { Store } from "@emulators/core";
import type { NangoConnection, NangoRecordsMap } from "./types.js";

const KEY = {
  connections: "nango_connections",
  records: "nango_records",
  init: "_nango_init",
} as const;

type ConnectionsMap = Map<string, NangoConnection>;
type RecordsMap = Map<string, NangoRecordsMap>; // key = connection_id

export function getNangoStore(store: Store) {
  if (!store.getData(KEY.init)) {
    store.setData(KEY.connections, new Map<string, NangoConnection>());
    store.setData(KEY.records, new Map<string, NangoRecordsMap>());
    store.setData(KEY.init, true);
  }

  const connections = store.getData<ConnectionsMap>(KEY.connections)!;
  const records = store.getData<RecordsMap>(KEY.records)!;

  return {
    getConnection(id: string): NangoConnection | undefined {
      return connections.get(id);
    },
    listConnections(providerConfigKey?: string): NangoConnection[] {
      const all = [...connections.values()];
      if (!providerConfigKey) return all;
      return all.filter((c) => c.provider_config_key === providerConfigKey);
    },
    upsertConnection(conn: NangoConnection): void {
      connections.set(conn.id, conn);
    },
    refreshCredentials(id: string): NangoConnection | undefined {
      const conn = connections.get(id);
      if (!conn) return undefined;
      const now = new Date();
      const newToken = `nango-refreshed-${Math.random().toString(36).slice(2)}${now.getTime().toString(36)}`;
      conn.credentials = {
        ...conn.credentials,
        access_token: newToken,
        expires_at: new Date(now.getTime() + 3600 * 1000).toISOString(),
        raw: {
          ...(conn.credentials.raw ?? {}),
          access_token: newToken,
          token_type: "Bearer",
          expires_in: 3600,
          refreshed_at: now.toISOString(),
        },
      };
      conn.updated_at = now.toISOString();
      return conn;
    },
    updateMetadata(id: string, metadata: Record<string, unknown>): boolean {
      const conn = connections.get(id);
      if (!conn) return false;
      conn.metadata = { ...conn.metadata, ...metadata };
      conn.updated_at = new Date().toISOString();
      return true;
    },
    getRecords(connectionId: string, model: string, providerHint?: string): Record<string, unknown>[] {
      const direct = records.get(connectionId)?.[model];
      if (direct && direct.length > 0) return direct;
      // Fallback: find seeded records for the same provider (by connection or hint)
      const conn = connections.get(connectionId);
      const provider = conn?.provider ?? providerHint;
      if (provider) {
        for (const [id, rmap] of records.entries()) {
          if (id === connectionId) continue;
          const sibling = connections.get(id);
          // Match by provider name or provider_config_key prefix
          if (
            sibling &&
            (sibling.provider === provider ||
              sibling.provider_config_key === provider ||
              sibling.provider_config_key.startsWith(provider)) &&
            rmap[model]?.length
          ) {
            return rmap[model];
          }
        }
      }
      return [];
    },
    setRecords(connectionId: string, model: string, data: Record<string, unknown>[]): void {
      const existing = records.get(connectionId) ?? {};
      records.set(connectionId, { ...existing, [model]: data });
    },
    /**
     * Append rows onto a model's live array (creating the model if absent),
     * leaving sibling models untouched. `setRecords` replaces — this is what a
     * live activity stream uses to drip one new record at a time.
     */
    appendRecords(connectionId: string, model: string, rows: Record<string, unknown>[]): number {
      const existing = records.get(connectionId) ?? {};
      const arr = existing[model] ?? [];
      const next = [...arr, ...rows];
      records.set(connectionId, { ...existing, [model]: next });
      return next.length;
    },
    allRecordsForConnection(connectionId: string): NangoRecordsMap {
      return records.get(connectionId) ?? {};
    },
  };
}

export type NangoStoreFacade = ReturnType<typeof getNangoStore>;
