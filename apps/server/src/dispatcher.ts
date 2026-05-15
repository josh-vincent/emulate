import { Hono } from "hono";
import {
  createServer,
  type AppKeyResolver,
  type CollectionSnapshot,
  type ServicePlugin,
  type Store,
  type StoreSnapshot,
  type TokenMap,
  type AppEnv,
} from "@emulators/core";
import { SERVICE_REGISTRY, SERVICE_NAMES, type ServiceName } from "emulate";

export interface ServiceApp {
  name: ServiceName;
  hono: { fetch: (req: Request) => Response | Promise<Response> };
  store: Store;
  tokenMap: TokenMap;
  plugin: ServicePlugin;
  seedFromConfig?: (store: Store, baseUrl: string, config: unknown) => void;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function rewriteResponse(response: Response, servicePrefix: string): Promise<Response> {
  const contentType = response.headers.get("Content-Type") ?? "";
  const location = response.headers.get("Location");
  const isHtml = contentType.includes("text/html");
  const locationChanged = location != null && location.startsWith("/");

  if (!isHtml) {
    if (!locationChanged) return response;
    const headers = new Headers(response.headers);
    headers.set("Location", servicePrefix + location);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  let html = await response.text();
  html = html.replace(/(action|href)="(\/[^"]*?)"/g, (_m, attr, path) =>
    path.startsWith(servicePrefix) ? `${attr}="${path}"` : `${attr}="${servicePrefix}${path}"`,
  );
  html = html.replace(/url\('(\/[^']*?)'\)/g, (_m, path) =>
    path.startsWith(servicePrefix) ? `url('${path}')` : `url('${servicePrefix}${path}')`,
  );

  const headers = new Headers(response.headers);
  if (locationChanged) headers.set("Location", servicePrefix + location);
  headers.delete("Content-Length");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export interface BuildOptions {
  baseUrl: string;
  serviceConfigs: Record<string, Record<string, unknown> | undefined>;
  tokens: Record<string, { login: string; id: number; scopes?: string[] }>;
}

export async function buildServiceApps(
  servicesToLoad: ServiceName[],
  opts: BuildOptions,
): Promise<Map<ServiceName, ServiceApp>> {
  const apps = new Map<ServiceName, ServiceApp>();

  for (const name of servicesToLoad) {
    const entry = SERVICE_REGISTRY[name];
    if (!entry) continue;
    const loaded = await entry.load();
    const svcSeedConfig = opts.serviceConfigs[name];
    const baseUrl = `${opts.baseUrl}/${name}`;

    // eslint-disable-next-line prefer-const -- reassigned after closure captures it
    let cachedResolver: AppKeyResolver | undefined;
    const appKeyResolver: AppKeyResolver | undefined = loaded.createAppKeyResolver
      ? (appId) => cachedResolver!(appId)
      : undefined;

    const fallbackUser = entry.defaultFallback(svcSeedConfig);

    const { app, store, tokenMap } = createServer(loaded.plugin, {
      baseUrl,
      tokens: opts.tokens,
      appKeyResolver,
      fallbackUser,
    });
    cachedResolver = loaded.createAppKeyResolver?.(store);

    loaded.plugin.seed?.(store, baseUrl);
    if (svcSeedConfig && loaded.seedFromConfig) {
      loaded.seedFromConfig(store, baseUrl, svcSeedConfig);
    }

    apps.set(name, {
      name,
      hono: app,
      store,
      tokenMap,
      plugin: loaded.plugin,
      seedFromConfig: loaded.seedFromConfig,
    });
  }

  return apps;
}

// Collections that hold OAuth credentials issued during live connect flows.
// These must survive a reseed so existing integrations don't break.
const AUTH_COLLECTIONS = ["oauthTokens", "refreshTokens", "authCodes", "accessTokens"];

// _data Map keys (set via store.setData) that hold auth state. These live in
// the snapshot's "data" object, not "collections", and must be merged back
// separately. WorkOS stores refresh tokens, sessions, and auth codes here.
const AUTH_DATA_KEYS = ["workos_refresh_tokens", "workos_sessions", "workos_auth_codes"];

export function reseedApps(
  apps: Map<ServiceName, ServiceApp>,
  serviceConfigs: Record<string, Record<string, unknown> | undefined>,
  baseUrl: string,
): void {
  for (const [name, sa] of apps) {
    // Preserve live OAuth credentials across the reset so connected integrations
    // don't need to re-authorise every time the seed config changes.
    const beforeSnap = sa.store.snapshot();

    const savedCollections: Record<string, CollectionSnapshot> = {};
    for (const colName of AUTH_COLLECTIONS) {
      if (beforeSnap.collections[colName]) {
        savedCollections[colName] = beforeSnap.collections[colName];
      }
    }

    const savedData: Record<string, unknown> = {};
    for (const key of AUTH_DATA_KEYS) {
      if (key in beforeSnap.data) {
        savedData[key] = beforeSnap.data[key];
      }
    }

    sa.store.reset();
    const svcBase = `${baseUrl}/${name}`;
    sa.plugin.seed?.(sa.store, svcBase);
    const svcSeedConfig = serviceConfigs[name];
    if (svcSeedConfig && sa.seedFromConfig) {
      sa.seedFromConfig(sa.store, svcBase, svcSeedConfig);
    }

    // Merge saved auth state back on top of the freshly seeded snapshot
    const hasSaved = Object.keys(savedCollections).length > 0 || Object.keys(savedData).length > 0;
    if (hasSaved) {
      const afterSnap: StoreSnapshot = sa.store.snapshot();
      for (const [colName, colSnap] of Object.entries(savedCollections)) {
        afterSnap.collections[colName] = colSnap;
      }
      for (const [key, value] of Object.entries(savedData)) {
        afterSnap.data[key] = value;
      }
      sa.store.restore(afterSnap);
    }
  }
}

// Paths that some vendor SDKs hit at root because they don't support a
// path-prefix in their hostname config. We forward these to the matching
// service so callers configured with HOST=localhost PORT=4000 still work
// alongside path-routed access at /<service>/*.
//
// Order matters: longer / more specific prefixes first.
const ROOT_FALLBACK_ROUTES: Array<{ prefix: string; service: ServiceName }> = [
  { prefix: "/user_management", service: "workos" },
  { prefix: "/sso", service: "workos" },
  { prefix: "/organizations", service: "workos" },
  { prefix: "/directory", service: "workos" },
  { prefix: "/directory_users", service: "workos" },
  { prefix: "/directory_groups", service: "workos" },
  { prefix: "/audit_logs", service: "workos" },
  { prefix: "/events", service: "workos" },
  { prefix: "/portal", service: "workos" },
];

async function forwardToService(sa: ServiceApp, raw: Request, pathOverride?: string): Promise<Response> {
  const url = new URL(raw.url);
  const path = pathOverride ?? url.pathname;
  const targetUrl = new URL(path + url.search, url.origin);
  const init: RequestInit & { duplex?: string } = {
    method: raw.method,
    headers: raw.headers,
  };
  if (MUTATING_METHODS.has(raw.method)) {
    init.body = raw.body;
    init.duplex = "half";
  }
  return sa.hono.fetch(new Request(targetUrl.toString(), init as RequestInit));
}

export function mountDispatcher(parent: Hono<AppEnv>, apps: Map<ServiceName, ServiceApp>): void {
  parent.all("/:service/*", async (c, next) => {
    const serviceName = c.req.param("service") as ServiceName;
    const sa = apps.get(serviceName);
    // Unknown first segment — let downstream root-fallback / 404 handle it.
    if (!sa) return next();

    const url = new URL(c.req.url);
    const stripped = url.pathname.slice(`/${serviceName}`.length) || "/";
    let response = await forwardToService(sa, c.req.raw, stripped);
    response = await rewriteResponse(response, `/${serviceName}`);
    return response;
  });

  // Root-level fallback for SDKs that don't support a path prefix. Matches
  // a small allowlist of well-known vendor paths and forwards them to the
  // service unchanged (no prefix rewrite, since the caller is treating the
  // server as if it were the vendor's root).
  parent.all("*", async (c, next) => {
    const url = new URL(c.req.url);
    const match = ROOT_FALLBACK_ROUTES.find(
      (r) => url.pathname === r.prefix || url.pathname.startsWith(`${r.prefix}/`),
    );
    if (!match) return next();
    const sa = apps.get(match.service);
    if (!sa) return next();
    return forwardToService(sa, c.req.raw);
  });
}

export { SERVICE_NAMES };
export type { ServiceName };
