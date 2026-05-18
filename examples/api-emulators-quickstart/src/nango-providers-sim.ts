// Nango providers — 3-month simulation for xero, quickbooks, google-drive,
// onedrive, with FULL nango-endpoint coverage.
//
// Seeds four connections each carrying ~90 days of dated records across two
// models, then drives every generic Nango route (connections, records,
// metadata, sync trigger, inbound + outbound webhooks, connect sessions) plus
// the provider-native `/proxy/*` path for each provider:
//
//   xero        GET /proxy/api.xro/2.0/Invoices         → Xero envelope
//   quickbooks  GET /proxy/v3/company/<realm>/query     → QBO query
//   google-drive GET /proxy/drive/v3/files              → Drive fileList
//   onedrive    GET /proxy/v1.0/me/drive/root/children  → Graph driveItems
//
//   pnpm --filter api-emulators-quickstart nango-providers-sim
import { nangoPlugin, seedFromConfig } from "@emulators/nango";
import { heading, mount } from "./harness.js";

const BASE = "http://localhost:4030";
const DAY = 86_400_000;
const START = Date.now() - 90 * DAY;
const iso = (n: number): string => new Date(START + n * DAY).toISOString();
const date = (n: number): string => iso(n).slice(0, 10);

// Every generic nango route the sim must touch (hubspot-emu OAuth shim is
// provider-specific and out of scope for these four providers).
const ROUTES = [
  "GET /",
  "GET /connect",
  "GET /connection",
  "GET /connections/:connectionId",
  "GET /records",
  "POST /connection",
  "POST /connections/:connectionId/records/:model",
  "PATCH /connection/:connectionId/metadata",
  "PUT /connection/:connectionId/metadata",
  "POST /sync/trigger",
  "GET /webhook-settings",
  "POST /webhook-settings",
  "GET /webhook-deliveries",
  "POST /webhook/:environmentUuid/:providerConfigKey",
  "POST /connect/sessions",
  "POST /connect/sessions/reconnect",
  "POST /connect/complete",
  "ALL /proxy/*",
] as const;

const covered = new Set<string>();
let calls = 0;
let failures = 0;
let app: { request: (u: string, i?: RequestInit) => Response | Promise<Response> };

async function hit(route: string, url: string, init: RequestInit | undefined, okStatuses: number[]): Promise<Response> {
  covered.add(route);
  calls++;
  const res = await app.request(url, init);
  const ok = okStatuses.includes(res.status);
  if (!ok) {
    failures++;
    console.log(`  ✗ ${route}  →  ${res.status}  ${url}`);
  } else {
    console.log(`  ✓ ${route.padEnd(48)} →  ${res.status}`);
  }
  return res;
}

const J = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ── 90 days of dated records, in each provider's native field shape ─────────
function xeroRecords() {
  const Invoice = Array.from({ length: 30 }, (_, i) => ({
    InvoiceID: `xero-inv-${i}`,
    InvoiceNumber: `INV-${1000 + i}`,
    Type: "ACCREC",
    Status: i % 4 === 0 ? "PAID" : "AUTHORISED",
    Total: 500 + i * 25,
    Date: `/Date(${START + i * 3 * DAY})/`,
    Contact: { ContactID: `xero-c-${i % 5}`, Name: `Customer ${i % 5}` },
  }));
  const Contact = Array.from({ length: 5 }, (_, i) => ({
    ContactID: `xero-c-${i}`,
    Name: `Customer ${i}`,
    EmailAddress: `c${i}@xero.example`,
  }));
  return { Invoice, Contact };
}
function quickbooksRecords() {
  const Invoice = Array.from({ length: 30 }, (_, i) => ({
    Id: String(i + 1),
    DocNumber: `1${String(i).padStart(3, "0")}`,
    TxnDate: date(i * 3),
    TotalAmt: 750 + i * 30,
    Balance: i % 3 === 0 ? 0 : 750 + i * 30,
    CustomerRef: { value: String((i % 4) + 1), name: `QB Customer ${i % 4}` },
  }));
  const Customer = Array.from({ length: 4 }, (_, i) => ({
    Id: String(i + 1),
    DisplayName: `QB Customer ${i}`,
    PrimaryEmailAddr: { Address: `qb${i}@example.test` },
  }));
  return { Invoice, Customer };
}
function driveRecords() {
  const DriveFile = Array.from({ length: 40 }, (_, i) => ({
    id: `gdrive-${i}`,
    name: `Report-${date(Math.floor(i * 2.25))}.pdf`,
    mimeType: "application/pdf",
    modifiedTime: iso(Math.floor(i * 2.25)),
    size: String(10_000 + i * 512),
  }));
  return { DriveFile };
}
function onedriveRecords() {
  const DriveItem = Array.from({ length: 40 }, (_, i) => ({
    id: `od-${i}`,
    name: `Doc-${date(Math.floor(i * 2.25))}.docx`,
    size: 8_000 + i * 400,
    lastModifiedDateTime: iso(Math.floor(i * 2.25)),
    file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  }));
  return { DriveItem };
}

async function main(): Promise<void> {
  const emu = mount(nangoPlugin, BASE);
  app = emu.app;

  seedFromConfig(emu.store, BASE, {
    connections: [
      {
        id: "xero-acme",
        provider: "xero",
        provider_config_key: "xero",
        connection_config: { tenantId: "tenant-acme" },
        metadata: { organizationId: "org_acme" },
        records: xeroRecords(),
      },
      {
        id: "quickbooks-acme",
        provider: "quickbooks",
        provider_config_key: "quickbooks",
        connection_config: { realmId: "9341453644728342" },
        metadata: { organizationId: "org_acme" },
        records: quickbooksRecords(),
      },
      {
        id: "google-drive-acme",
        provider: "google-drive",
        provider_config_key: "google-drive",
        metadata: { organizationId: "org_acme" },
        records: driveRecords(),
      },
      {
        id: "onedrive-acme",
        provider: "onedrive",
        provider_config_key: "onedrive",
        metadata: { organizationId: "org_acme" },
        records: onedriveRecords(),
      },
    ],
  });

  const providers = [
    { id: "xero-acme", key: "xero", models: ["Invoice", "Contact"] },
    { id: "quickbooks-acme", key: "quickbooks", models: ["Invoice", "Customer"] },
    { id: "google-drive-acme", key: "google-drive", models: ["DriveFile"] },
    { id: "onedrive-acme", key: "onedrive", models: ["DriveItem"] },
  ];

  heading("Nango sim — org-wide surface (4 connections, 90 days of records)");

  await hit("GET /", `${BASE}/`, undefined, [200]);
  await hit("GET /connect", `${BASE}/connect`, undefined, [200]);
  await hit("GET /connection", `${BASE}/connection`, undefined, [200]);
  // A backend programmatically registers a new connection (token already held).
  await hit(
    "POST /connection",
    `${BASE}/connection`,
    J({
      connection_id: "xero-sandbox",
      provider_config_key: "xero",
      credentials: { access_token: "tok-sandbox", refresh_token: "ref-sandbox" },
      connection_config: { tenantId: "tenant-sandbox" },
      metadata: { organizationId: "org_acme" },
    }),
    [200, 201],
  );
  await hit("GET /webhook-settings", `${BASE}/webhook-settings`, undefined, [200]);
  await hit(
    "POST /webhook-settings",
    `${BASE}/webhook-settings`,
    J({ url: "https://consumer.example/nango", events: ["sync", "forward"] }),
    [200],
  );

  for (const p of providers) {
    heading(`Nango sim — ${p.key}`);

    await hit(
      "GET /connections/:connectionId",
      `${BASE}/connections/${p.id}`,
      { headers: { "Provider-Config-Key": p.key } },
      [200],
    );

    for (const model of p.models) {
      await hit(
        "GET /records",
        `${BASE}/records?model=${model}`,
        { headers: { "Connection-Id": p.id, "Provider-Config-Key": p.key } },
        [200],
      );
    }

    // A live record lands today (3-month window + 1 fresh tick).
    await hit(
      "POST /connections/:connectionId/records/:model",
      `${BASE}/connections/${p.id}/records/${p.models[0]}`,
      J({ records: [{ id: `live-${p.key}-today`, _liveAt: iso(90) }] }),
      [200],
    );

    // Persist sync cursor (PATCH merge) then overwrite (PUT replace).
    await hit(
      "PATCH /connection/:connectionId/metadata",
      `${BASE}/connection/${p.id}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastSyncedAt: iso(90) }),
      },
      [200],
    );
    await hit(
      "PUT /connection/:connectionId/metadata",
      `${BASE}/connection/${p.id}/metadata`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: "org_acme", cursor: "c-90" }),
      },
      [200],
    );

    await hit(
      "POST /sync/trigger",
      `${BASE}/sync/trigger`,
      J({ connection_id: p.id, provider_config_key: p.key, model: p.models[0] }),
      [200],
    );

    // Provider POSTs to its inbound webhook URL → Nango forwards it.
    await hit(
      "POST /webhook/:environmentUuid/:providerConfigKey",
      `${BASE}/webhook/env-1/${p.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Connection-Id": p.id },
        body: JSON.stringify({ event: "record.updated", model: p.models[0] }),
      },
      [200],
    );
  }

  heading("Nango sim — provider-native /proxy calls");

  const proxy = async (key: string, id: string, path: string) =>
    hit(
      "ALL /proxy/*",
      `${BASE}/proxy/${path}`,
      { headers: { "Connection-Id": id, "Provider-Config-Key": key } },
      [200],
    );

  // Xero pluralises the response key (Invoice → Invoices).
  const xr = (await (await proxy("xero", "xero-acme", "api.xro/2.0/Invoices")).json()) as {
    Invoices?: unknown[];
    Status?: string;
  };
  console.log(`    ↳ Xero envelope: Status=${xr.Status}, Invoices rows=${xr.Invoices?.length ?? 0}`);

  const qq = encodeURIComponent("SELECT * FROM Invoice STARTPOSITION 1 MAXRESULTS 100");
  const qbr = (await (
    await proxy("quickbooks", "quickbooks-acme", `v3/company/9341453644728342/query?query=${qq}`)
  ).json()) as {
    QueryResponse?: { Invoice?: unknown[] };
  };
  console.log(`    ↳ QBO QueryResponse.Invoice rows=${qbr.QueryResponse?.Invoice?.length ?? 0}`);

  const gd = (await (await proxy("google-drive", "google-drive-acme", "drive/v3/files?pageSize=10")).json()) as {
    kind?: string;
    files?: unknown[];
  };
  console.log(`    ↳ Drive ${gd.kind}: ${gd.files?.length ?? 0} files (page)`);

  const od = (await (await proxy("onedrive", "onedrive-acme", "v1.0/me/drive/root/children?$top=10")).json()) as {
    value?: unknown[];
  };
  console.log(`    ↳ Graph driveItems: ${od.value?.length ?? 0} items (page)`);

  heading("Nango sim — connect-session handshake + reconnect");

  const sess = (await (
    await hit(
      "POST /connect/sessions",
      `${BASE}/connect/sessions`,
      J({ end_user: { id: "user_42", tags: { organizationId: "org_acme" } }, allowed_integrations: ["xero"] }),
      [200, 201],
    )
  ).json()) as { data: { token: string } };
  await hit(
    "POST /connect/sessions/reconnect",
    `${BASE}/connect/sessions/reconnect`,
    J({ connection_id: "xero-acme" }),
    [200, 201],
  );
  await hit("POST /connect/complete", `${BASE}/connect/complete`, J({ token: sess.data.token }), [200, 201]);

  await hit("GET /webhook-deliveries", `${BASE}/webhook-deliveries`, undefined, [200]);

  heading("Nango sim — coverage report");

  const missing = ROUTES.filter((r) => !covered.has(r));
  const deliveries = (await (await app.request(`${BASE}/webhook-deliveries`)).json()) as { deliveries: unknown[] };
  console.log(`\n  ${calls} calls • ${failures} unexpected failures`);
  console.log(`  webhook deliveries captured: ${deliveries.deliveries.length} (sync + forward across 4 providers)`);
  console.log(`  route coverage: ${covered.size}/${ROUTES.length}`);
  if (missing.length) console.log(`  ❌ MISSING: ${missing.join(" | ")}`);
  const ok = missing.length === 0 && failures === 0;
  console.log(
    `\n${ok ? "✅" : "❌"} Nango 4-provider 3-month simulation ${ok ? "complete — full route coverage" : "INCOMPLETE"}.\n`,
  );
  if (!ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
