// `emulate start`, pre-loaded with a *comprehensive 90-day quarter*.
//
// The problem this solves: `simpro-sim` / `uptick-sim` build a full, dated,
// every-endpoint quarter — but they run in-process and EXIT, so the data
// never reaches a server your app can talk to. This script is the handoff:
//
//   1. FACTORY — run both sims with their *_SIM_EXPORT hooks so each writes
//      its round-trippable seed config to disk (the durable artifact that
//      outlives the sim process).
//   2. MERGE   — combine the SimPro + Uptick quarters with WorkOS (login) and
//      Nango (already-linked Google connections + 90d history) into one seed.
//   3. SERVE   — boot the per-port `emulate` CLI seeded from it. The quarter
//      now lives behind real HTTP and PERSISTS until you Ctrl-C. Your app
//      reads it like the real providers; nothing disappears.
//   4. STREAM  — layer the unbounded simulator on top so the Nango feed keeps
//      growing while the SimPro/Uptick backfill stays put.
//
//   pnpm --filter api-emulators-quickstart seeded-server
//   pnpm --filter api-emulators-quickstart seeded-server -- --seconds 8
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(HERE, "../../..");
const EMULATE_CLI = join(REPO_ROOT, "packages/emulate/dist/index.js");
const SIM_CLI = join(REPO_ROOT, "packages/@emulators/simulator/dist/cli.js");
const SCENARIO = join(HERE, "../scenarios/live-feed.yaml");
const TSX_BIN = [join(REPO_ROOT, "node_modules/.bin/tsx"), join(EXAMPLE_DIR, "node_modules/.bin/tsx")].find(existsSync);

// `--service` order fixes the port offsets (basePort + index).
const SERVICES = ["workos", "google", "nango", "simpro", "uptick"] as const;
const BASE_PORT = 4000;
const portOf = (svc: (typeof SERVICES)[number]): number => BASE_PORT + SERVICES.indexOf(svc);
const url = (svc: (typeof SERVICES)[number]): string => `http://localhost:${portOf(svc)}`;

const DAY = 86_400_000;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const seconds = Number(arg("--seconds") ?? process.env.SEEDED_SERVER_SECONDS ?? "0") || 0;

/** ~90 days of dated history for one Nango model (newest ≈3d old, oldest ≈90d). */
function history(idPrefix: string, extra: (n: number) => Record<string, unknown>): Record<string, unknown>[] {
  return Array.from({ length: 30 }, (_, i) => {
    const daysAgo = 90 - i * 3;
    return { id: `${idPrefix}-${i}`, _historyAt: new Date(Date.now() - daysAgo * DAY).toISOString(), ...extra(i) };
  });
}

function nangoConnections(): Record<string, unknown> {
  return {
    connections: [
      {
        id: "gm-acme",
        provider: "gmail",
        provider_config_key: "google-mail",
        metadata: { organizationId: "org_acme", linkedBy: "dev@acme.example" },
        records: { messages: history("hist-m", (n) => ({ snippet: `Archived message ${n}` })) },
      },
      {
        id: "dr-acme",
        provider: "drive",
        provider_config_key: "google-drive",
        metadata: { organizationId: "org_acme", linkedBy: "dev@acme.example" },
        records: { files: history("hist-f", (n) => ({ name: `Document ${n}.gdoc` })) },
      },
      {
        id: "cal-acme",
        provider: "calendar",
        provider_config_key: "google-calendar",
        metadata: { organizationId: "org_acme", linkedBy: "dev@acme.example" },
        records: { events: history("hist-e", (n) => ({ summary: `Past meeting ${n}` })) },
      },
    ],
  };
}

const workosBlock = (): Record<string, unknown> => ({
  users: [{ email: "dev@acme.example", first_name: "Dev", last_name: "User", password: "DevPassword123!" }],
  organizations: [{ name: "Acme Inc", slug: "acme" }],
  memberships: [{ user_email: "dev@acme.example", organization_slug: "acme", role: "owner" }],
  oauth_clients: [
    { client_id: "client_app_01", client_secret: "sk_app_secret", redirect_uris: ["http://localhost:3000/callback"] },
  ],
});

function runFactory(label: string, script: string, exportEnv: string, outPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    if (!TSX_BIN) return reject(new Error("tsx binary not found — run `pnpm install`"));
    console.log(`[seeded-server] factory: ${label} (building + asserting a 90-day quarter)…`);
    const child = spawn(TSX_BIN, [join("src", script)], {
      cwd: EXAMPLE_DIR,
      env: { ...process.env, [exportEnv]: outPath },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let tail = "";
    child.stderr?.on("data", (d: Buffer) => (tail = (tail + d).slice(-2000)));
    child.on("exit", (code) => {
      if (code === 0 && existsSync(outPath)) {
        console.log(`[seeded-server]   ↳ ${label} quarter exported`);
        resolvePromise();
      } else {
        reject(new Error(`${label} factory failed (exit ${code}).\n${tail}`));
      }
    });
  });
}

async function waitForReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await Promise.all([
        fetch(`${url("workos")}/`),
        fetch(`${url("nango")}/connection`),
        fetch(`${url("simpro")}/inspector/jobs`),
        fetch(`${url("uptick")}/?tab=defects`),
      ]);
      if (r.every((x) => x.status < 500)) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error("seeded per-port server did not become ready within timeout");
}

function banner(counts: { simpro: number; uptick: number }): void {
  const line = "─".repeat(76);
  console.log(`\n${line}`);
  console.log("  emulate is LIVE — per-port, pre-seeded with a 90-day quarter (persists)\n");
  for (const s of SERVICES) console.log(`    ${s.padEnd(8)} ${url(s)}`);
  console.log("\n  Paste into your app's env (host-only, no path prefix):\n");
  console.log(`    WORKOS_BASE_URL=${url("workos")}   WORKOS_CLIENT_ID=client_app_01`);
  console.log(`    GOOGLE_BASE_URL=${url("google")}`);
  console.log(`    NANGO_HOST=${url("nango")}`);
  console.log(`    SIMPRO_BASE_URL=${url("simpro")}`);
  console.log(`    UPTICK_BASE_URL=${url("uptick")}`);
  console.log(`\n  Seeded quarter (read it over HTTP — it does NOT disappear):`);
  console.log(`    SimPro  ${counts.simpro} jobs/quotes/invoices, full graph, every endpoint`);
  console.log(`            browse: ${url("simpro")}/inspector/jobs`);
  console.log(`            api:    GET ${url("simpro")}/api/v1.0/companies/0/jobs  (Bearer token)`);
  console.log(`    Uptick  ${counts.uptick} defects across clients/properties/assets`);
  console.log(`            browse: ${url("uptick")}/?tab=defects`);
  console.log(`            api:    GET ${url("uptick")}/api/v2/defects/  (Bearer token)`);
  console.log(`    Nango   3 Google connections, ~90 days of history each`);
  console.log(
    seconds > 0
      ? `\n  Streaming live Nango activity for ${seconds}s, then shutting down…`
      : "\n  Streaming live Nango activity on top — Ctrl-C to stop (seeded data stays).",
  );
  console.log(`${line}\n`);
}

async function main(): Promise<void> {
  for (const [path, hint] of [
    [EMULATE_CLI, "pnpm --filter emulate build"],
    [SIM_CLI, "pnpm --filter @emulators/simulator build"],
  ] as const) {
    if (!existsSync(path))
      throw new Error(`Build not found at ${path}.\nRun \`pnpm -w build\` (or \`${hint}\`) first.`);
  }

  const workdir = mkdtempSync(join(tmpdir(), "emulate-seeded-"));
  const simproOut = join(workdir, "simpro.json");
  const uptickOut = join(workdir, "uptick.json");
  let server: ChildProcess | undefined;
  let sim: ChildProcess | undefined;
  let shuttingDown = false;

  const shutdown = (code = 0): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[seeded-server] shutting down…");
    if (sim && !sim.killed) sim.kill("SIGTERM");
    if (server && !server.killed) server.kill("SIGTERM");
    rmSync(workdir, { recursive: true, force: true });
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  try {
    // 1 + 2 — run the factories, then merge their exports into one seed.
    await runFactory("SimPro", "simpro-sim.ts", "SIMPRO_SIM_EXPORT", simproOut);
    await runFactory("Uptick", "uptick-sim.ts", "UPTICK_SIM_EXPORT", uptickOut);

    const simpro = (JSON.parse(readFileSync(simproOut, "utf8")) as { simpro: Record<string, unknown> }).simpro;
    const uptick = (JSON.parse(readFileSync(uptickOut, "utf8")) as { uptick: Record<string, unknown> }).uptick;
    const seedPath = join(workdir, "seed.json");
    writeFileSync(
      seedPath,
      JSON.stringify({ workos: workosBlock(), nango: nangoConnections(), simpro, uptick }, null, 2),
    );
    const counts = {
      simpro: (simpro.jobs as unknown[] | undefined)?.length ?? 0,
      uptick: (uptick.defects as unknown[] | undefined)?.length ?? 0,
    };

    // 3 — long-lived per-port server seeded from the merged quarter.
    console.log(`[seeded-server] booting per-port emulate (${SERVICES.join(", ")})…`);
    server = spawn(
      process.execPath,
      [EMULATE_CLI, "start", "--service", SERVICES.join(","), "--port", String(BASE_PORT), "--seed", seedPath],
      { cwd: workdir, env: { ...process.env }, stdio: ["ignore", "ignore", "pipe"] },
    );
    server.stderr?.on("data", (d: Buffer) => process.stderr.write(`  [emulate] ${d}`));
    server.on("exit", (c) => {
      if (!shuttingDown && c) shutdown(1);
    });

    await waitForReady(25_000);
    banner(counts);

    // 4 — unbounded live Nango feed on top of the static backfill.
    const simArgs = [SIM_CLI, "run", SCENARIO, "--base", url("nango")];
    if (seconds > 0) simArgs.push("--duration", String(seconds));
    sim = spawn(process.execPath, simArgs, { cwd: REPO_ROOT, env: { ...process.env }, stdio: "inherit" });
    sim.on("exit", (c) => shutdown(c && c !== 0 ? 1 : 0));

    await new Promise<void>(() => {}); // alive until SIGINT (or bounded sim exit)
  } catch (err) {
    console.error("\n[seeded-server] FAILED:\n", err);
    shutdown(1);
  }
}

main().catch((err: unknown) => {
  console.error("\n[seeded-server] FAILED:\n", err);
  process.exit(1);
});
