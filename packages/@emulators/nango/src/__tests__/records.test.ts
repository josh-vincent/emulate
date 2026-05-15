import { describe, it, expect } from "vitest";
import { BASE, ORG_SEED, createTestApp } from "./helpers.js";

type NangoRecord = Record<string, unknown> & {
  _nango_metadata: {
    first_seen_at: string;
    last_modified_at: string;
    last_action: string;
    cursor: string;
    deleted_at: null;
  };
};

// The /records sync API is how an org pulls normalised data out of every
// linked integration (one model name per object type).
describe("Nango /records sync API", () => {
  it("returns synced rows wrapped with _nango_metadata", async () => {
    const { app } = createTestApp({ seed: ORG_SEED });

    const res = await app.request(`${BASE}/records?model=Invoice`, {
      headers: { "Connection-Id": "xero-acme", "Provider-Config-Key": "xero" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records: NangoRecord[]; next_cursor: null };
    expect(body.next_cursor).toBeNull();
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({ InvoiceID: "xero-inv-1", InvoiceNumber: "INV-001" });
    expect(body.records[0]._nango_metadata).toMatchObject({
      last_action: "ADDED",
      cursor: "emu_cursor_0",
      deleted_at: null,
    });
    expect(typeof body.records[0]._nango_metadata.first_seen_at).toBe("string");
  });

  it("trailing-slash /records/ behaves identically", async () => {
    const { app } = createTestApp({ seed: ORG_SEED });
    const res = await app.request(`${BASE}/records/?model=Customer`, {
      headers: { "Connection-Id": "quickbooks-acme" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records: NangoRecord[] };
    expect(body.records[0]).toMatchObject({ id: "qb-cust-1", DisplayName: "Acme Co" });
  });

  it("missing Connection-Id or model → 400", async () => {
    const { app } = createTestApp({ seed: ORG_SEED });

    const noModel = await app.request(`${BASE}/records`, { headers: { "Connection-Id": "xero-acme" } });
    expect(noModel.status).toBe(400);
    expect((await noModel.json()) as { message: string }).toMatchObject({
      message: "Missing Connection-Id header or model query param",
    });

    const noConn = await app.request(`${BASE}/records?model=Invoice`);
    expect(noConn.status).toBe(400);
  });

  it("unknown model yields an empty record set (not an error)", async () => {
    const { app } = createTestApp({ seed: ORG_SEED });
    const res = await app.request(`${BASE}/records?model=PurchaseOrder`, {
      headers: { "Connection-Id": "xero-acme" },
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { records: unknown[] }).toEqual({ records: [], next_cursor: null });
  });

  it("falls back to a same-provider sibling connection's records", async () => {
    // A freshly created xero connection with no synced records of its own
    // still resolves Invoices from the seeded xero connection.
    const { app } = createTestApp({
      seed: {
        connections: [...ORG_SEED.connections!, { id: "xero-second", provider: "xero", provider_config_key: "xero" }],
      },
    });

    const res = await app.request(`${BASE}/records?model=Invoice`, {
      headers: { "Connection-Id": "xero-second", "Provider-Config-Key": "xero" },
    });
    const body = (await res.json()) as { records: NangoRecord[] };
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({ InvoiceID: "xero-inv-1" });
  });
});
