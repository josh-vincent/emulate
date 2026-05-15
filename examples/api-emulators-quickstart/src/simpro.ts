// Simpro Premium emulator — field-service job management API.
//
// Demonstrates the Simpro OAuth 2.0 authorization-code flow followed by the
// company-scoped REST surface (companies, jobs, customers) and a webhook
// subscription (the POST is the only time the signing Secret is returned).
//
//   pnpm --filter api-emulators-quickstart simpro
import { simproPlugin, seedFromConfig } from "@emulators/simpro";
import { call, heading, mount } from "./harness.js";

const BASE = "http://localhost:4010";

async function main(): Promise<void> {
  const emu = mount(simproPlugin, BASE);

  seedFromConfig(emu.store, BASE, {
    oauth: { client_id: "taskr_dev", client_secret: "taskr_dev_secret" },
    companies: [{ id: 0, name: "Taskr Test Co" }],
    customers: [
      {
        id: 200,
        type: "company",
        company_name: "Acme Facilities Pty Ltd",
        email: "ops@acme.example",
        sites: [{ id: 55, name: "North Campus Building A" }],
      },
    ],
    jobs: [
      {
        id: 12345,
        type: "Project",
        name: "Sprinkler Overhaul Q3",
        customer_id: 200,
        site_id: 55,
        stage: 3,
        order_no: "PO-4481",
      },
    ],
  });

  heading("Simpro — OAuth 2.0 authorization-code flow");

  const authorize = await emu.app.request(
    `${BASE}/oauth/authorize?client_id=taskr_dev&redirect_uri=http://localhost/cb&state=s`,
    { redirect: "manual" },
  );
  const code = new URL(authorize.headers.get("Location")!).searchParams.get("code")!;
  console.log(`\n▶ GET /oauth/authorize  →  302  (code=${code.slice(0, 12)}…)`);

  const token = (await call(emu, "Exchange the code for an access token", `${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "authorization_code", code, client_id: "taskr_dev" }),
  })) as { access_token: string };

  const auth = { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };

  heading("Simpro — company-scoped REST surface");

  await call(emu, "List companies (the multi-company root)", `${BASE}/api/v1.0/companies/`, { headers: auth });

  await call(emu, "Fetch a job (Stage resolves to its label)", `${BASE}/api/v1.0/companies/0/jobs/12345`, {
    headers: auth,
  });

  await call(emu, "List customers", `${BASE}/api/v1.0/companies/0/customers/`, { headers: auth });

  heading("Simpro — webhook subscription");

  await call(emu, "Register a webhook (Secret returned exactly once)", `${BASE}/api/v1.0/companies/0/setup/webhooks/`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ URL: "https://example.test/hook", Events: ["job.created", "job.updated"] }),
  });

  await call(emu, "List webhooks (Secret is now omitted)", `${BASE}/api/v1.0/companies/0/setup/webhooks/`, {
    headers: auth,
  });

  console.log("\n✅ Simpro demo complete.\n");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
