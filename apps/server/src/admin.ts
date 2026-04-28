import { Hono } from "hono";
import type { AppEnv } from "@emulators/core";
import { reseedApps, type ServiceApp, type ServiceName } from "./dispatcher.js";
import { expandUnifiedUsers, listUnifiedUsers, type MintedToken } from "./seed/users.js";
import type { EmulateConfig } from "./config.js";
import { SERVICE_NAMES } from "emulate";

export interface AdminState {
  apps: Map<ServiceName, ServiceApp>;
  config: EmulateConfig;
  tokens: MintedToken[];
  baseUrl: string;
}

export function createAdminRouter(state: AdminState): Hono<AppEnv> {
  const admin = new Hono<AppEnv>();
  const adminToken = process.env.EMULATE_ADMIN_TOKEN;

  admin.use("*", async (c, next) => {
    if (c.req.path === "/_admin/health") return next();
    if (!adminToken) return next();
    const header = c.req.header("Authorization") ?? "";
    const expected = `Bearer ${adminToken}`;
    if (header !== expected) return c.json({ message: "Unauthorized" }, 401);
    return next();
  });

  admin.get("/_admin/health", (c) => c.json({ status: "ok", services: [...state.apps.keys()] }));

  admin.get("/_admin/users", (c) =>
    c.json({
      users: listUnifiedUsers(state.config, state.tokens),
      tokens: state.tokens,
    }),
  );

  admin.get("/_admin/config", (c) => c.json(state.config));

  admin.post("/_admin/reset", (c) => {
    for (const sa of state.apps.values()) sa.store.reset();
    return c.json({ status: "reset", services: [...state.apps.keys()] });
  });

  admin.post("/_admin/seed", async (c) => {
    let body: EmulateConfig;
    try {
      body = (await c.req.json()) as EmulateConfig;
    } catch {
      return c.json({ message: "Invalid JSON body" }, 400);
    }

    state.config = body;
    state.tokens = expandUnifiedUsers(state.config);

    // Sync new tokens into each service's tokenMap.
    for (const sa of state.apps.values()) {
      sa.tokenMap.clear();
      if (state.config.tokens) {
        let id = 100;
        for (const [tok, user] of Object.entries(state.config.tokens)) {
          sa.tokenMap.set(tok, {
            login: user.login,
            id: id++,
            scopes: user.scopes ?? [],
          });
        }
      }
    }

    const serviceConfigs: Record<string, Record<string, unknown> | undefined> = {};
    for (const name of SERVICE_NAMES) {
      serviceConfigs[name] = state.config[name] as Record<string, unknown> | undefined;
    }
    reseedApps(state.apps, serviceConfigs, state.baseUrl);

    return c.json({
      status: "seeded",
      services: [...state.apps.keys()],
      users: listUnifiedUsers(state.config, state.tokens),
    });
  });

  return admin;
}
