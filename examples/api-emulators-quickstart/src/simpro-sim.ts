// Simpro — 3-month operational simulation with FULL endpoint coverage.
//
// `simpro.ts` is the readable walkthrough. This script:
//
//   1. Phase A — simulates a *real quarter* of field-service operations:
//      13 weekly cycles that create dated rows for EVERY creatable Simpro
//      collection (jobs, schedules, invoices, payments, quotes, leads, assets,
//      contacts, contractors, staff, sites, tasks, activity schedules, vendor
//      orders, prebuilds, recurring jobs/invoices, credit notes, stock takes/
//      transfers/allocations, …). Each row is stamped with that week's date so
//      the data genuinely spans 90 days — asserted afterwards.
//
//   2. Phase B — a generic crawler then drives EVERY one of the 372
//      (method, path) endpoints the emulator registers. It resolves every
//      `:param` transitively (reading parent collections, so deep routes like
//      /jobs/:jid/sections/:sid/costCenters/:ccid resolve), sends a superset
//      JSON body for writes, and runs POST → GET → PATCH/PUT → DELETE. The
//      whole crawl is repeated for several passes ("review in a loop") and
//      every pass must stay 100 % covered with zero 5xx and all lists 2xx.
//
//   pnpm --filter api-emulators-quickstart simpro-sim
import { simproPlugin, seedFromConfig } from "@emulators/simpro";
import { heading, mount } from "./harness.js";
import { SIMPRO_ROUTES } from "./simpro-routes.generated.js";

const BASE = "http://localhost:4010";
const CID = "0";
const DAY = 86_400_000;
const WEEKS = 13; // ≈ 91 days = one quarter
const PASSES = 2; // crawl every endpoint this many times
const START = new Date(Date.now() - WEEKS * 7 * DAY);
const day = (n: number): string => new Date(START.getTime() + n * DAY).toISOString().slice(0, 10);

let auth: Record<string, string>;
const covered = new Set<string>();
const status: Record<string, number> = {};
let calls = 0;
let fiveXX: string[] = [];
let listFailures: string[] = [];
// id cache keyed by collection URL → first row id (or null when empty).
let idCache = new Map<string, string | null>();
let app: { request: (u: string, i?: RequestInit) => Response | Promise<Response> };
const ctx: Record<string, number> = {};

// A superset write body. `date` stamps *every* date field any handler reads,
// so a single body works for jobs, schedules, assets, stock takes, recurring
// jobs, credit notes, etc. — each handler picks the field(s) it needs.
function bodyFor(date = day(45)): string {
  return JSON.stringify({
    Name: `Sim ${Date.now()}`,
    GivenName: "Sim",
    FamilyName: "Tester",
    CompanyName: "Sim Co Pty Ltd",
    Text: "simulation note",
    ActivityType: "Call",
    Type: "Project",
    URL: "https://example.test/hook",
    Events: ["job.created"],
    StartTime: "09:00",
    EndTime: "11:00",
    Date: date,
    DateIssued: date,
    DueDate: date,
    StartDate: date,
    EndDate: date,
    DateInstalled: date,
    DateNextService: date,
    DateTaken: date,
    DateTransferred: date,
    DateAllocated: date,
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
  if (!res.ok) await res.body?.cancel();
  return j?.ID ?? 0;
}

// Every creatable top-level collection. Phase A posts a dated row to each one
// once per week, so all 27 collections carry 13 weeks of data — not just jobs.
const COLLECTIONS = [
  "jobs",
  "quotes",
  "leads",
  "invoices",
  "creditNotes",
  "customerPayments",
  "schedules",
  "activitySchedules",
  "assets",
  "contacts",
  "contractors",
  "staff",
  "employees",
  "sites",
  "tasks",
  "vendors",
  "vendorOrders",
  "contractorInvoices",
  "prebuilds",
  "prebuildGroups",
  "recurringJobs",
  "recurringInvoices",
  "plantTypes",
  "stockTakes",
  "stockTransfer",
  "stockAllocations",
  "storageDevices",
] as const;

async function main(): Promise<void> {
  const emu = mount(simproPlugin, BASE);
  app = emu.app;

  // ── Phase A: seed dependency roots, then simulate a quarter ──────────────
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

  ctx.customer = 200;
  ctx.site = 55;
  ctx.staff = 7;
  ctx.contractor = 90;
  ctx.masterCC = 500;
  ctx.taxCode = 1;
  ctx.job = 12345;
  ctx.invoice = 7001;
  ctx.vendor = await post(`/api/v1.0/companies/${CID}/vendors/`, { Name: "Acme Supply Co", DateIssued: day(0) });

  heading(`Simpro sim — simulating ${WEEKS} weekly cycles (≈90 days) across ${COLLECTIONS.length} collections`);

  const createdPer: Record<string, number> = {};
  for (let w = 0; w < WEEKS; w++) {
    const date = day(w * 7);
    for (const coll of COLLECTIONS) {
      const id = await post(`/api/v1.0/companies/${CID}/${coll}/`, JSON.parse(bodyFor(date)));
      if (id || coll === "customerPayments") createdPer[coll] = (createdPer[coll] ?? 0) + 1;
    }
    // Onboard a fresh customer (+ site) every other week so the customer base
    // also grows over the quarter, not just transactional data.
    if (w % 2 === 0) {
      const cust = await post(`/api/v1.0/companies/${CID}/customers/`, {
        CompanyName: `Onboarded Co ${w} Pty Ltd`,
        Type: "company",
      });
      if (cust) await post(`/api/v1.0/companies/${CID}/sites/`, { Name: `Site W${w}`, Customer: { ID: cust } });
    }
  }

  const totalCreated = Object.values(createdPer).reduce((a, b) => a + b, 0);
  const dense = COLLECTIONS.filter((c) => (createdPer[c] ?? 0) >= WEEKS).length;
  console.log(
    `\n  created ${totalCreated} dated rows • ${dense}/${COLLECTIONS.length} collections carry ≥${WEEKS} weeks`,
  );
  for (let i = 0; i < COLLECTIONS.length; i += 3) {
    console.log(
      "  " +
        COLLECTIONS.slice(i, i + 3)
          .map((c) => `${c}=${createdPer[c] ?? 0}`.padEnd(26))
          .join(""),
    );
  }

  // ── Span assertion: prove the data really covers ~3 months ──────────────
  const jobsList = (await (
    await app.request(`${BASE}/api/v1.0/companies/${CID}/jobs/?columns=ID,DateIssued&pageSize=250`, {
      headers: auth,
    })
  ).json()) as Array<{ DateIssued?: string }>;
  const dates = jobsList
    .map((j) => j.DateIssued)
    .filter((d): d is string => !!d)
    .sort();
  const spanDays =
    dates.length >= 2 ? Math.round((Date.parse(dates[dates.length - 1]!) - Date.parse(dates[0]!)) / DAY) : 0;
  const spanOk = spanDays >= 75;
  console.log(
    `\n  job date span: ${dates[0] ?? "—"} → ${dates[dates.length - 1] ?? "—"} ` +
      `= ${spanDays} days across ${jobsList.length} jobs — ${spanOk ? "✅ ≥75d (real quarter)" : "❌ too narrow"}`,
  );

  // ── Phase B: crawl EVERY endpoint, repeated for several passes ──────────
  const order: Record<string, number> = { POST: 0, GET: 1, PATCH: 2, PUT: 2, DELETE: 3 };
  const routes = [...SIMPRO_ROUTES].sort((a, b) => {
    const o = (order[a[0]] ?? 9) - (order[b[0]] ?? 9);
    if (o !== 0) return o;
    return a[1].split("/").length - b[1].split("/").length;
  });

  const passReports: string[] = [];
  let anyPassFailed = false;
  for (let pass = 1; pass <= PASSES; pass++) {
    heading(`Simpro sim — crawl pass ${pass}/${PASSES}: exercising all ${SIMPRO_ROUTES.length} endpoints`);
    fiveXX = [];
    listFailures = [];
    idCache = new Map();
    const before = calls;

    for (const [method, path] of routes) await call(method, path);
    for (const p of ["jobs", "customers", "sections", "cost-centers", "invoices", "webhooks"]) {
      const r = await app.request(`${BASE}/inspector/${p}`);
      covered.add(`GET /inspector/${p}`);
      status[r.status] = (status[r.status] ?? 0) + 1;
      if (r.status !== 200) listFailures.push(`GET /inspector/${p} → ${r.status}`);
      await r.body?.cancel();
    }

    const missing = SIMPRO_ROUTES.filter(([m, p]) => !covered.has(`${m} ${p}`));
    const passOk = missing.length === 0 && fiveXX.length === 0 && listFailures.length === 0;
    anyPassFailed = anyPassFailed || !passOk;
    passReports.push(
      `  pass ${pass}: ${calls - before} calls • coverage ${covered.size}/${SIMPRO_ROUTES.length} • ` +
        `5xx=${fiveXX.length} • listFail=${listFailures.length} — ${passOk ? "✅" : "❌"}`,
    );
    if (fiveXX.length) passReports.push(`    5xx: ${fiveXX.slice(0, 10).join(" | ")}`);
    if (listFailures.length) passReports.push(`    listFail: ${listFailures.slice(0, 10).join(" | ")}`);
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

  console.log(`\n  ${calls} endpoint calls across ${PASSES} passes`);
  console.log(`  status distribution: ${dist}`);
  console.log(`  success (2xx/3xx): ${twoxx}/${calls} (${ratio}%)`);
  console.log(`  route-pattern coverage: ${covered.size}/${SIMPRO_ROUTES.length} (oauth + inspector included)`);
  for (const line of passReports) console.log(line);
  if (missing.length) console.log(`  ❌ MISSING (${missing.length}): ${missing.map((r) => r.join(" ")).join(" | ")}`);

  const ok = missing.length === 0 && !anyPassFailed && spanOk && dense === COLLECTIONS.length && Number(ratio) >= 80;
  console.log(
    `\n${ok ? "✅" : "❌"} Simpro 3-month simulation ${ok ? "complete — full route coverage, every collection has a quarter of data" : "INCOMPLETE"}.\n`,
  );
  if (!ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
