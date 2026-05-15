import type { AppEnv } from "@emulators/core";
import type { Hono } from "hono";
import type { NangoStoreFacade } from "../store.js";

/**
 * Parse QuickBooks SQL-style query to extract entity name.
 * e.g. "SELECT * FROM Invoice STARTPOSITION 1 MAXRESULTS 100" → "Invoice"
 */
function parseQBEntity(query: string): string | null {
  const match = /FROM\s+(\w+)/i.exec(query);
  return match?.[1] ?? null;
}

/**
 * Build a QuickBooks QueryResponse envelope.
 * QB returns: { QueryResponse: { Invoice: [...], totalCount, startPosition, maxResults }, time }
 */
function buildQBResponse(entity: string, rows: Record<string, unknown>[], startPosition = 1) {
  return {
    QueryResponse: {
      [entity]: rows,
      totalCount: rows.length,
      startPosition,
      maxResults: rows.length,
    },
    time: new Date().toISOString(),
  };
}

/**
 * Infer entity name from Xero-style URL path.
 * e.g. "api.xro/2.0/Invoices" → "Invoice"
 *      "api.xro/2.0/Contacts" → "Contact"
 */
function inferXeroModel(path: string): string | null {
  // Take the last path segment, remove query string
  const segment = path.split("?")[0]?.split("/").pop();
  if (!segment) return null;
  // Xero pluralizes: Invoices → Invoice, Contacts → Contact
  if (segment.endsWith("s")) return segment.slice(0, -1);
  return segment;
}

/**
 * Build a Xero response envelope.
 * Xero returns: { [EntityPlural]: [...], Status: "OK", DateTimeUTC: "..." }
 */
function buildXeroResponse(entityPlural: string, rows: Record<string, unknown>[]) {
  return {
    [entityPlural]: rows,
    Status: "OK",
    DateTimeUTC: `/Date(${Date.now()})/`,
  };
}

export function proxyRoutes(app: Hono<AppEnv>, ns: NangoStoreFacade): void {
  // QuickBooks proxy: GET /proxy/v3/company/:realmId/query
  // Convex sends: Authorization, Provider-Config-Key, Connection-Id headers
  app.get("/proxy/v3/company/:realmId/query", (c) => {
    const query = c.req.query("query") ?? "";
    const connectionId = c.req.header("Connection-Id") ?? c.req.header("connection-id") ?? "";
    const entity = parseQBEntity(query);

    if (!entity) {
      return c.json({ error: "Could not parse entity from query", query }, 400);
    }

    const rows = ns.getRecords(connectionId, entity, "quickbooks");
    return c.json(buildQBResponse(entity, rows));
  });

  // Generic Nango proxy: GET/POST/PUT /proxy/:path*
  // Handles Xero, MYOB, and other providers.
  // Route pattern must come after the QB-specific route.
  app.all("/proxy/*", (c) => {
    // Strip the /proxy/ prefix to get the provider-specific path
    const fullPath = c.req.path.replace(/^\/proxy\//, "");
    const connectionId = c.req.header("Connection-Id") ?? c.req.header("connection-id") ?? "";
    const providerConfigKey = c.req.header("Provider-Config-Key") ?? c.req.header("provider-config-key") ?? "";

    // Determine provider from path or config key
    const isXero = fullPath.startsWith("api.xro/") || providerConfigKey.includes("xero");
    const isMyob = fullPath.startsWith("api.myob.com/") || providerConfigKey.includes("myob");

    if (isXero) {
      const model = inferXeroModel(fullPath);
      if (!model) return c.json({ Status: "OK", [fullPath]: [] });
      const rows = ns.getRecords(connectionId, model, "xero");
      // Xero uses plural for the response key
      const plural = model.endsWith("s") ? model : `${model}s`;
      return c.json(buildXeroResponse(plural, rows));
    }

    if (isMyob) {
      // MYOB uses a REST-style response
      const segment = fullPath.split("?")[0]?.split("/").pop() ?? "Items";
      const rows = ns.getRecords(connectionId, segment, "myob");
      return c.json({ Items: rows, Count: rows.length, TotalCount: rows.length });
    }

    // Generic fallback — return empty array-style response
    const allRecords = ns.allRecordsForConnection(connectionId);
    return c.json({ records: Object.values(allRecords).flat(), path: fullPath });
  });
}
