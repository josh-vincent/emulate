import { Hono } from "hono";
import {
  createServer,
  type AppKeyResolver,
  type ServicePlugin,
  type Store,
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

export function reseedApps(
  apps: Map<ServiceName, ServiceApp>,
  serviceConfigs: Record<string, Record<string, unknown> | undefined>,
  baseUrl: string,
): void {
  for (const [name, sa] of apps) {
    sa.store.reset();
    const svcBase = `${baseUrl}/${name}`;
    sa.plugin.seed?.(sa.store, svcBase);
    const svcSeedConfig = serviceConfigs[name];
    if (svcSeedConfig && sa.seedFromConfig) {
      sa.seedFromConfig(sa.store, svcBase, svcSeedConfig);
    }
  }
}

export function mountDispatcher(parent: Hono<AppEnv>, apps: Map<ServiceName, ServiceApp>): void {
  parent.all("/:service/*", async (c) => {
    const serviceName = c.req.param("service") as ServiceName;
    const sa = apps.get(serviceName);
    if (!sa) return c.json({ message: `Unknown service: ${serviceName}` }, 404);

    const url = new URL(c.req.url);
    const stripped = url.pathname.slice(`/${serviceName}`.length) || "/";
    const strippedUrl = new URL(stripped + url.search, url.origin);

    const original = c.req.raw;
    const init: RequestInit & { duplex?: string } = {
      method: original.method,
      headers: original.headers,
    };
    if (MUTATING_METHODS.has(original.method)) {
      init.body = original.body;
      init.duplex = "half";
    }
    const strippedReq = new Request(strippedUrl.toString(), init as RequestInit);

    let response = await sa.hono.fetch(strippedReq);
    response = await rewriteResponse(response, `/${serviceName}`);
    return response;
  });
}

export { SERVICE_NAMES };
export type { ServiceName };
