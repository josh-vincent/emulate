// Uptick emulator — asset & defect management for fire-protection field work.
//
// Demonstrates the Uptick OAuth 2.0 password grant followed by the JSON:API
// resource surface: list clients and assets, then raise a defect against a
// seeded asset (property/client are auto-resolved from the asset relationship).
//
//   pnpm --filter api-emulators-quickstart uptick
import { uptickPlugin, seedFromConfig } from "@emulators/uptick";
import { call, heading, mount } from "./harness.js";

const BASE = "http://localhost:4020";

interface JsonApiList {
  data: Array<{ type: string; id: string; attributes: Record<string, unknown> }>;
}

async function main(): Promise<void> {
  const emu = mount(uptickPlugin, BASE);

  // A contractor that services Acme's fire-protection assets through Uptick.
  seedFromConfig(emu.store, BASE, {
    asset_types: [{ name: "Sprinkler System", description: "Wet/dry pipe sprinkler network" }],
    clients: [
      {
        name: "Acme Facilities Pty Ltd",
        sector: "Commercial",
        ref: "ACME-001",
        contact_name: "Dana Ops",
        contact_email: "ops@acme.example",
      },
    ],
    properties: [
      {
        name: "North Campus Building A",
        client_name: "Acme Facilities Pty Ltd",
        address_streetline: "12 Industrial Ave",
        address_city: "Sydney",
        address_state: "NSW",
        address_postcode: "2000",
      },
    ],
    assets: [
      {
        name: "Sprinkler Riser #1",
        asset_number: "FP-RISER-001",
        asset_type_name: "Sprinkler System",
        property_name: "North Campus Building A",
        client_name: "Acme Facilities Pty Ltd",
        standard_maintenance: "Annual AS1851 inspection",
      },
    ],
  });

  heading("Uptick — OAuth 2.0 password grant");

  const token = (await call(emu, "Exchange technician credentials for a token", `${BASE}/api/oauth2/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: "tech@demo.com.au",
      password: "hunter2",
    }).toString(),
  })) as { access_token: string };

  const auth = {
    Authorization: `Bearer ${token.access_token}`,
    "Content-Type": "application/vnd.api+json",
  };

  heading("Uptick — JSON:API resource surface");

  await call(emu, "List clients (JSON:API envelope)", `${BASE}/api/v2/clients/`, { headers: auth });

  const assets = (await call(emu, "List assets (relationships resolved)", `${BASE}/api/v2/assets/`, {
    headers: auth,
  })) as JsonApiList;
  const assetId = assets.data[0]!.id;

  heading("Uptick — raise a defect against the seeded asset");

  // Only the asset relationship is supplied; the emulator backfills the
  // property and client from the asset, mirroring Uptick's behaviour.
  await call(emu, "Create a defect (property/client auto-resolved)", `${BASE}/api/v2/defects/`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      data: {
        type: "Defect",
        attributes: {
          description: "Riser gauge reading below spec",
          severity: "high",
          status: "open",
        },
        relationships: {
          asset: { data: { type: "Asset", id: assetId } },
        },
      },
    }),
  });

  await call(emu, "List defects (the new one is persisted)", `${BASE}/api/v2/defects/`, { headers: auth });

  console.log("\n✅ Uptick demo complete.\n");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
