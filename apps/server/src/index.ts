import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import pc from "picocolors";
import { registerFontRoutes, type AppEnv } from "@emulators/core";
import { SERVICE_NAMES } from "./plugins.js";
import { loadConfig } from "./config.js";
import { expandUnifiedUsers } from "./seed/users.js";
import { buildServiceApps, mountDispatcher, type ServiceName } from "./dispatcher.js";
import { createAdminRouter } from "./admin.js";
import { createInspectorRouter } from "./inspector.js";

async function main() {
  const port = Number.parseInt(process.env.PORT ?? "4000", 10);
  const baseUrl = process.env.EMULATE_BASE_URL ?? `http://localhost:${port}`;

  const loaded = await loadConfig();
  const config = loaded?.config ?? {};
  const source = loaded?.source ?? "(none — booting with hardcoded defaults only)";

  const tokens = expandUnifiedUsers(config);

  const tokenMap: Record<string, { login: string; id: number; scopes?: string[] }> = {};
  let id = 100;
  for (const [tok, user] of Object.entries(config.tokens ?? {})) {
    tokenMap[tok] = { login: user.login, id: id++, scopes: user.scopes };
  }

  const present = SERVICE_NAMES.filter((name) => name in config);
  const services: ServiceName[] = present.length > 0 ? present : [...SERVICE_NAMES];

  const serviceConfigs: Record<string, Record<string, unknown> | undefined> = {};
  for (const name of SERVICE_NAMES) {
    serviceConfigs[name] = config[name] as Record<string, unknown> | undefined;
  }

  const apps = await buildServiceApps(services, { baseUrl, serviceConfigs, tokens: tokenMap });

  const parent = new Hono<AppEnv>();
  registerFontRoutes(parent);
  parent.use("*", cors());

  parent.get("/", (c) =>
    c.json({
      service: "emulate-server",
      services: [...apps.keys()],
      users: tokens.length,
      inspector: `${baseUrl}/_inspector`,
      docs: "https://emulate.dev",
    }),
  );

  parent.route("/", createInspectorRouter({ apps, baseUrl }));
  parent.route("/", createAdminRouter({ apps, config, tokens, baseUrl }));
  mountDispatcher(parent, apps);

  serve({ fetch: parent.fetch, port });
  printBanner({ port, baseUrl, source, services: [...apps.keys()], tokens });
}

interface BannerOpts {
  port: number;
  baseUrl: string;
  source: string;
  services: string[];
  tokens: Array<{ token: string; login: string }>;
}

function printBanner({ port, baseUrl, source, services, tokens }: BannerOpts) {
  console.log("");
  console.log(`  ${pc.bold("emulate-server")} ${pc.dim(`listening on :${port}`)}`);
  console.log(`  ${pc.dim("Base URL:")} ${pc.bold(baseUrl)}`);
  console.log(`  ${pc.dim("Config:")}   ${source}`);
  console.log("");
  console.log(`  ${pc.dim("Services")}`);
  for (const name of services) {
    console.log(`    ${pc.cyan(name.padEnd(12))} ${baseUrl}/${name}`);
  }
  if (tokens.length > 0) {
    console.log("");
    console.log(`  ${pc.dim("Unified user tokens")}`);
    for (const t of tokens) {
      console.log(`    ${pc.dim(t.token)} ${pc.dim("->")} ${t.login}`);
    }
  }
  console.log("");
  console.log(`  ${pc.dim("Admin:")} ${baseUrl}/_admin/health`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
