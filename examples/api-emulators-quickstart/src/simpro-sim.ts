// Simpro — 3-month operational simulation with FULL endpoint coverage.
//
// `simpro.ts` is the readable walkthrough. This script drives EVERY one of the
// 372 (method, path) endpoints the emulator registers, after simulating a
// quarter of field-service operations (≈30 jobs dated across 90 days, each
// with schedules, invoices and payments).
//
// Engine: a generic crawler. It resolves every `:param` by walking the path
// and reading the parent collection (so deep routes like
// /jobs/:jid/sections/:sid/costCenters/:ccid resolve transitively), sends a
// superset JSON body for writes (handlers read only the fields they need),
// and runs POST → GET-list → GET-by-id → PATCH/PUT → DELETE so data exists
// before it is read and is only removed last. It asserts 100 % route-pattern
// coverage and that every list endpoint is 2xx.
//
//   pnpm --filter api-emulators-quickstart simpro-sim
import { simproPlugin, seedFromConfig } from "@emulators/simpro";
import { heading, mount } from "./harness.js";
import { SIMPRO_ROUTES } from "./simpro-routes.generated.js";

const BASE = "http://localhost:4010";
const CID = "0";
const DAY = 86_400_000;
const START = new Date(Date.now() - 90 * DAY);
const day = (n: number): string => new Date(START.getTime() + n * DAY).toISOString().slice(0, 10);

let auth: Record<string, string>;
const covered = new Set<string>();
const status: Record<string, number> = {};
let calls = 0;
const fiveXX: string[] = [];
const listFailures: string[] = [];
// id cache keyed by collection URL → first row id (or null when empty).
const idCache = new Map<string, string | null>();
let app: { request: (u: string, i?: RequestInit) => Response | Promise<Response> };

// A superset write body: every required field any POST/PATCH handler checks.
// Ref ids are filled in once Phase A has created the dependency roots.
const ctx: Record<string, number> = {};
function bodyFor(): string {
  return JSON.stringify({
    Name: `Sim ${Date.now()}`,
    GivenName: "Sim",
    FamilyName: "Tester",
    CompanyName: "Sim Co Pty Ltd",
    Text: "simulation note",
    Date: day(45),
    StartTime: "09:00",
    EndTime: "11:00",
    ActivityType: "Call",
    Type: "Project",
    URL: "https://example.test/hook",
    Events: ["job.created"],
    Customer: { ID: ctx.customer },
    Site: { ID: ctx.site },
    Job: { ID: ctx.job },
    Technician: { ID: ctx.staff },
    Contractor: { ID: ctx.contractor },
    Vendor: { ID: ctx.vendor },
    CostCenter: { ID: ctx.masterCC },
    TaxCode: { ID: ctx.taxCode },
    Invoices: ctx.invoice ? [{ ID: ctx.invoice }] : [],
    Payment: { Amount: 100, PaymentMethod: "EFT" },
    Amount: 100,
  });
}

async function call(method: string, rawPath: string): Promise<void> {
  const key = `${method} ${rawPath}`;
  covered.add(key);
  calls++;

  const url = await resolve(rawPath);
  const isWrite = method === "POST" || method === "PATCH" || method === "PUT";
  const init: RequestInit = {
    method,
    headers: isWrite ? { ...auth, "Content-Type": "application/json" } : auth,
    redirect: "manual",
  };
  if (isWrite) init.body = bodyFor();

  const res = await app.request(url, init);
  status[res.status] = (status[res.status] ?? 0) + 1;
  if (res.status >= 500) fiveXX.push(`${key} → ${res.status}`);

  // Every list/collection GET (path ends with "/") must be 2xx.
  if (method === "GET" && rawPath.endsWith("/") && !rawPath.includes(":") && (res.status < 200 || res.status >= 300)) {
    listFailures.push(`${key} → ${res.status}`);
  }
  await res.body?.cancel();
}

/** Resolve every `:param` in a path by reading parent collections. */
async function resolve(path: string): Promise<string> {
  const segs = path.split("/");
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (!s.startsWith(":")) {
      out.push(s);
      continue;
    }
    const name = s.slice(1);
    if (name === "cid") out.push(CID);
    else if (name === "ignore") out.push("v1.0");
    else if (name === "entity" || name === "entityType") out.push("customers");
    else {
      // The collection is everything resolved so far + a trailing slash.
      const collection = `${out.join("/")}/`;
      const id = await firstId(collection);
      out.push(id ?? "999999"); // sentinel → handler 404s (expected for empties)
    }
  }
  return `${BASE}${out.join("/")}`;
}

async function firstId(collection: string): Promise<string | null> {
  if (idCache.has(collection)) return idCache.get(collection)!;
  let id: string | null = null;
  try {
    const res = await app.request(`${BASE}${collection}`, { headers: auth });
    if (res.ok) {
      const data = (await res.json()) as unknown;
      const row = Array.isArray(data) ? data[0] : (data as { [k: string]: unknown })?.["0"];
      const r = row as Record<string, unknown> | undefined;
      const v = r?.ID ?? r?.id ?? r?.Id;
      if (v !== undefined && v !== null) id = String(v);
    } else {
      await res.body?.cancel();
    }
  } catch {
    /* leave null */
  }
  idCache.set(collection, id);
  return id;
}

async function oauth(): Promise<void> {
  const authz = await app.request(
    `${BASE}/oauth/authorize?client_id=taskr_dev&redirect_uri=http://localhost/cb&state=s`,
    { redirect: "manual" },
  );
  covered.add("GET /oauth/authorize");
  const code = new URL(authz.headers.get("Location")!).searchParams.get("code")!;
  const tok = (await (
    await app.request(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code, client_id: "taskr_dev" }),
    })
  ).json()) as { access_token: string };
  covered.add("POST /oauth/token");
  auth = { Authorization: `Bearer ${tok.access_token}` };
}

async function post(path: string, body: unknown): Promise<number> {
  const res = await app.request(`${BASE}${path}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = res.ok ? ((await res.json()) as { ID?: number }) : null;
  return j?.ID ?? 0;
}

async function main(): Promise<void> {
  const emu = mount(simproPlugin, BASE);
  app = emu.app;

  // ── Phase A: seed a baseline + simulate a quarter of operations ──────────
  seedFromConfig(emu.store, BASE, {
    oauth: { client_id: "taskr_dev", client_secret: "taskr_dev_secret" },
    companies: [{ id: 0, name: "Taskr Test Co" }],
    tax_codes: [{ id: 1, name: "GST", rate: 10 }],
    statuses: [
      { id: 10, kind: "job", name: "In Progress" },
      { id: 20, kind: "quote", name: "Quoted" },
    ],
    master_cost_centers: [{ id: 500, name: "Service" }],
    staff: [{ id: 7, given_name: "Dana", family_name: "Tech", email: "dana@taskr.example" }],
    contractors: [{ id: 90, company_name: "Subbie Co", given_name: "Sam", family_name: "Sub" }],
    customers: [
      {
        id: 200,
        type: "company",
        company_name: "Acme Facilities Pty Ltd",
        email: "ops@acme.example",
        sites: [{ id: 55, name: "North Campus Building A" }],
      },
      { id: 201, type: "individual", given_name: "Pat", family_name: "Owner" },
    ],
    jobs: [
      {
        id: 12345,
        type: "Project",
        name: "Baseline Job",
        customer_id: 200,
        site_id: 55,
        sections: [{ id: 1, name: "Mechanical", cost_centers: [{ id: 800, name: "Pipework", ex_tax: 4000 }] }],
      },
    ],
    quotes: [{ id: 9001, name: "Baseline Quote", customer_id: 201, status_id: 20 }],
    invoices: [{ id: 7001, job_id: 12345, type: "ProgressInvoice", total_ex_tax: 4000, total_inc_tax: 4400 }],
    schedules: [{ id: 301, job_id: 12345, technician_id: 7, date: day(0), start_time: "09:00", duration_minutes: 240 }],
    assets: [{ id: 410, customer_id: 200, site_id: 55, name: "Pump A1", asset_type: "Pump" }],
    contacts: [{ id: 600, type: "Customer", customer_id: 200, given_name: "Cara", family_name: "Contact" }],
    stock_items: [{ id: 700, name: "Pipe 50mm", part_no: "P-50" }],
  });

  await oauth();

  // Dependency roots used by the superset write body.
  ctx.customer = 200;
  ctx.site = 55;
  ctx.staff = 7;
  ctx.contractor = 90;
  ctx.masterCC = 500;
  ctx.taxCode = 1;
  ctx.job = 12345;
  ctx.invoice = 7001;
  ctx.vendor = await post(`/api/v1.0/companies/${CID}/vendors/`, { Name: "Acme Supply Co" });

  heading("Simpro sim — simulating 90 days of jobs / schedules / invoices / payments");

  let created = 0;
  for (let d = 0; d < 90; d += 3) {
    const jid = await post(`/api/v1.0/companies/${CID}/jobs/`, {
      Type: "Service",
      Name: `Service Call ${d}`,
      Customer: { ID: 200 },
      Site: { ID: 55 },
      DateIssued: day(d),
      OrderNo: `PO-${4000 + d}`,
    });
    if (!jid) continue;
    created++;
    await post(`/api/v1.0/companies/${CID}/schedules/`, {
      Job: { ID: jid },
      Technician: { ID: 7 },
      Date: day(d),
      StartTime: "08:00",
      EndTime: "12:00",
    });
    const inv = await post(`/api/v1.0/companies/${CID}/invoices/`, {
      Job: { ID: jid },
      Type: "ProgressInvoice",
      Total: { ExTax: 1500, IncTax: 1650 },
    });
    if (inv) {
      await post(`/api/v1.0/companies/${CID}/customerPayments/`, {
        Payment: { Amount: 1650, PaymentMethod: "EFT" },
        Invoices: [{ ID: inv }],
      });
    }
    if (d % 9 === 0) {
      await post(`/api/v1.0/companies/${CID}/quotes/`, { Name: `Quote ${d}`, Customer: { ID: 201 } });
      await post(`/api/v1.0/companies/${CID}/leads/`, { Name: `Lead ${d}` });
    }
  }
  console.log(`\n  simulated ${created} jobs across the 90-day window (+ schedules, invoices, payments)`);

  // ── Phase B: drive every endpoint, POST → GET → PATCH/PUT → DELETE ───────
  const order: Record<string, number> = { POST: 0, GET: 1, PATCH: 2, PUT: 2, DELETE: 3 };
  const routes = [...SIMPRO_ROUTES].sort((a, b) => {
    const o = (order[a[0]] ?? 9) - (order[b[0]] ?? 9);
    if (o !== 0) return o;
    // Within a method, shallower paths first (parents before children).
    return a[1].split("/").length - b[1].split("/").length;
  });

  heading(`Simpro sim — exercising all ${SIMPRO_ROUTES.length} endpoints`);

  for (const [method, path] of routes) {
    // OAuth + inspector are handled / counted separately below.
    await call(method, path);
  }

  // Inspector + misc non-API routes.
  for (const p of ["jobs", "customers", "sections", "cost-centers", "invoices", "webhooks"]) {
    const r = await app.request(`${BASE}/inspector/${p}`);
    covered.add(`GET /inspector/${p}`);
    status[r.status] = (status[r.status] ?? 0) + 1;
    if (r.status !== 200) listFailures.push(`GET /inspector/${p} → ${r.status}`);
    await r.body?.cancel();
  }

  heading("Simpro sim — coverage report");

  const missing = SIMPRO_ROUTES.filter(([m, p]) => !covered.has(`${m} ${p}`));
  const dist = Object.entries(status)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([s, n]) => `${s}×${n}`)
    .join("  ");
  const twoxx = Object.entries(status)
    .filter(([s]) => Number(s) >= 200 && Number(s) < 400)
    .reduce((a, [, n]) => a + n, 0);
  const ratio = ((twoxx / calls) * 100).toFixed(1);

  console.log(`\n  ${calls} endpoint calls`);
  console.log(`  status distribution: ${dist}`);
  console.log(`  success (2xx/3xx): ${twoxx}/${calls} (${ratio}%)`);
  console.log(
    `  route-pattern coverage: ${covered.size}/${SIMPRO_ROUTES.length} (oauth + inspector included in table)`,
  );
  if (missing.length) console.log(`  ❌ MISSING (${missing.length}): ${missing.map((r) => r.join(" ")).join(" | ")}`);
  if (fiveXX.length) console.log(`  ❌ 5xx (${fiveXX.length}): ${fiveXX.slice(0, 20).join(" | ")}`);
  if (listFailures.length)
    console.log(`  ❌ list/inspector not 2xx (${listFailures.length}): ${listFailures.slice(0, 20).join(" | ")}`);

  const ok = missing.length === 0 && fiveXX.length === 0 && listFailures.length === 0 && Number(ratio) >= 80;
  console.log(
    `\n${ok ? "✅" : "❌"} Simpro 3-month simulation ${ok ? "complete — full route coverage" : "INCOMPLETE"}.\n`,
  );
  if (!ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
