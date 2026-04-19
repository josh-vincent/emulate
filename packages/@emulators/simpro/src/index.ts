import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@emulators/core";
import { getSimproStore } from "./store.js";
import type { BillingType, CostCenterStage, JobStage, JobType } from "./entities.js";
import { nowIso } from "./helpers.js";
import { oauthRoutes } from "./routes/oauth.js";
import { jobRoutes } from "./routes/jobs.js";
import { sectionRoutes } from "./routes/sections.js";
import { costCenterRoutes } from "./routes/costCenters.js";
import { customerRoutes } from "./routes/customers.js";
import { siteRoutes } from "./routes/sites.js";
import { staffRoutes } from "./routes/staff.js";
import { quoteRoutes } from "./routes/quotes.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { scheduleRoutes } from "./routes/schedules.js";
import { assetRoutes } from "./routes/assets.js";
import { referenceRoutes } from "./routes/reference.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { inspectorRoutes } from "./routes/inspector.js";

export { getSimproStore, type SimproStore } from "./store.js";
export { fireWebhook } from "./routes/webhooks.js";
export * from "./entities.js";

export interface SimproSeedConfig {
  port?: number;
  rate_limit_enabled?: boolean;
  oauth?: {
    client_id?: string;
    client_secret?: string;
  };
  companies?: Array<{ id: number; name: string }>;
  tax_codes?: Array<{ id: number; company_id?: number; name: string; rate: number }>;
  statuses?: Array<{
    id: number;
    company_id?: number;
    kind: "job" | "quote";
    name: string;
  }>;
  master_cost_centers?: Array<{
    id: number;
    company_id?: number;
    name: string;
    income_account?: string | null;
    expense_account?: string | null;
  }>;
  staff?: Array<{
    id: number;
    company_id?: number;
    given_name: string;
    family_name: string;
    email?: string | null;
  }>;
  customers?: Array<{
    id: number;
    company_id?: number;
    type: "company" | "individual";
    company_name?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    email?: string | null;
    sites?: Array<{ id: number; name: string }>;
  }>;
  jobs?: Array<{
    id: number;
    company_id?: number;
    type?: JobType;
    name: string;
    customer_id: number;
    site_id?: number | null;
    stage?: JobStage;
    order_no?: string | null;
    project_manager_id?: number | null;
    sections?: Array<{
      id: number;
      name: string;
      description?: string | null;
      cost_centers?: Array<{
        id: number;
        master_cost_center_id?: number | null;
        tax_code_id?: number | null;
        name?: string;
        billing_type?: BillingType;
        stage?: CostCenterStage;
        ex_tax?: number;
        inc_tax?: number;
      }>;
    }>;
  }>;
}

const DEFAULT_COMPANY_ID = 0;

export function seedFromConfig(store: Store, _baseUrl: string, config: SimproSeedConfig): void {
  const ss = getSimproStore(store);
  const now = nowIso();

  store.setData("simpro.rate_limit_enabled", Boolean(config.rate_limit_enabled));
  if (config.oauth) store.setData("simpro.oauth", config.oauth);

  for (const co of config.companies ?? []) {
    const existing = ss.companies.findOneBy("company_id", co.id);
    if (existing) ss.companies.update(existing.id, { name: co.name });
    else ss.companies.insert({ company_id: co.id, name: co.name });
  }

  for (const tc of config.tax_codes ?? []) {
    const row = {
      company_id: tc.company_id ?? DEFAULT_COMPANY_ID,
      external_id: tc.id,
      name: tc.name,
      rate: tc.rate,
    };
    const existing = ss.taxCodes.findOneBy("external_id", tc.id);
    if (existing) ss.taxCodes.update(existing.id, row);
    else ss.taxCodes.insert(row);
  }

  for (const st of config.statuses ?? []) {
    const row = {
      company_id: st.company_id ?? DEFAULT_COMPANY_ID,
      external_id: st.id,
      kind: st.kind,
      name: st.name,
    };
    const existing = ss.statuses.findOneBy("external_id", st.id);
    if (existing) ss.statuses.update(existing.id, row);
    else ss.statuses.insert(row);
  }

  for (const mcc of config.master_cost_centers ?? []) {
    const row = {
      company_id: mcc.company_id ?? DEFAULT_COMPANY_ID,
      external_id: mcc.id,
      name: mcc.name,
      archived: false,
      income_account: mcc.income_account ?? null,
      expense_account: mcc.expense_account ?? null,
    };
    const existing = ss.masterCostCenters.findOneBy("external_id", mcc.id);
    if (existing) ss.masterCostCenters.update(existing.id, row);
    else ss.masterCostCenters.insert(row);
  }

  for (const s of config.staff ?? []) {
    const row = {
      company_id: s.company_id ?? DEFAULT_COMPANY_ID,
      external_id: s.id,
      given_name: s.given_name,
      family_name: s.family_name,
      email: s.email ?? null,
      active: true,
    };
    const existing = ss.staff.findOneBy("external_id", s.id);
    if (existing) ss.staff.update(existing.id, row);
    else ss.staff.insert(row);
  }

  for (const cust of config.customers ?? []) {
    const row = {
      company_id: cust.company_id ?? DEFAULT_COMPANY_ID,
      external_id: cust.id,
      type: cust.type,
      company_name: cust.company_name ?? null,
      given_name: cust.given_name ?? null,
      family_name: cust.family_name ?? null,
      title: null,
      email: cust.email ?? null,
      phone_primary: null,
      website: null,
      ein: null,
      address: null,
      tax_code_id: null,
      payment_terms: null,
      archived: false,
      tags: [] as string[],
      custom_fields: [],
    };
    const existing = ss.customers.findOneBy("external_id", cust.id);
    if (existing) ss.customers.update(existing.id, row);
    else ss.customers.insert(row);

    for (const site of cust.sites ?? []) {
      const siteRow = {
        company_id: cust.company_id ?? DEFAULT_COMPANY_ID,
        external_id: site.id,
        customer_id: cust.id,
        name: site.name,
        address: null,
        contact_id: null,
        archived: false,
      };
      const existingSite = ss.sites.findOneBy("external_id", site.id);
      if (existingSite) ss.sites.update(existingSite.id, siteRow);
      else ss.sites.insert(siteRow);
    }
  }

  for (const job of config.jobs ?? []) {
    const jobRow = {
      company_id: job.company_id ?? DEFAULT_COMPANY_ID,
      external_id: job.id,
      type: job.type ?? "Project",
      name: job.name,
      description: null,
      order_no: job.order_no ?? null,
      request_no: null,
      customer_id: job.customer_id,
      customer_contact_id: null,
      site_id: job.site_id ?? null,
      site_contact_id: null,
      salesperson_id: null,
      project_manager_id: job.project_manager_id ?? null,
      technician_ids: [] as number[],
      stage: job.stage ?? 2,
      status_id: null,
      date_issued: now.slice(0, 10),
      due_date: null,
      due_time: null,
      tags: [] as string[],
      custom_fields: [],
      total_ex_tax: 0,
      total_tax: 0,
      total_inc_tax: 0,
      invoiced_ex_tax: 0,
      date_modified: now,
    };
    const existingJob = ss.jobs.findOneBy("external_id", job.id);
    if (existingJob) ss.jobs.update(existingJob.id, jobRow);
    else ss.jobs.insert(jobRow);

    let order = 1;
    for (const section of job.sections ?? []) {
      const sectionRow = {
        company_id: job.company_id ?? DEFAULT_COMPANY_ID,
        external_id: section.id,
        job_id: job.id,
        name: section.name,
        description: section.description ?? null,
        display_order: order,
        date_modified: now,
      };
      const existingSection = ss.sections.findOneBy("external_id", section.id);
      if (existingSection) ss.sections.update(existingSection.id, sectionRow);
      else ss.sections.insert(sectionRow);
      order++;

      for (const cc of section.cost_centers ?? []) {
        const ccRow = {
          company_id: job.company_id ?? DEFAULT_COMPANY_ID,
          external_id: cc.id,
          job_id: job.id,
          section_id: section.id,
          master_cost_center_id: cc.master_cost_center_id ?? null,
          tax_code_id: cc.tax_code_id ?? null,
          name: cc.name ?? `Cost Center ${cc.id}`,
          billing_type: cc.billing_type ?? "TimeAndMaterials",
          billable: true,
          stage: cc.stage ?? 2,
          ex_tax: cc.ex_tax ?? 0,
          tax: 0,
          inc_tax: cc.inc_tax ?? 0,
          invoiced_ex_tax: 0,
          markup: 0,
          discount: 0,
          is_variation: false,
          contractor_work_order_id: null,
          date_modified: now,
        };
        const existingCc = ss.costCenters.findOneBy("external_id", cc.id);
        if (existingCc) ss.costCenters.update(existingCc.id, ccRow);
        else ss.costCenters.insert(ccRow);
      }
    }
  }
}

function seedDefaults(store: Store, _baseUrl: string): void {
  const ss = getSimproStore(store);
  if (ss.companies.all().length > 0) return;

  seedFromConfig(store, _baseUrl, {
    companies: [{ id: 0, name: "Emulator Co" }],
    tax_codes: [
      { id: 1, name: "GST", rate: 10 },
      { id: 2, name: "GST Free", rate: 0 },
    ],
    statuses: [
      { id: 1, kind: "job", name: "Pending" },
      { id: 2, kind: "job", name: "In Progress" },
      { id: 3, kind: "job", name: "Complete" },
    ],
    master_cost_centers: [
      { id: 12, name: "Plumbing Materials", income_account: "4-1000" },
      { id: 15, name: "Electrical Labour", income_account: "4-1010" },
    ],
    staff: [
      { id: 1, given_name: "Taylor", family_name: "Rivera", email: "taylor@emulator.local" },
    ],
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
        sections: [
          {
            id: 1001,
            name: "Zone 1 – Ground Floor",
            cost_centers: [
              { id: 5001, master_cost_center_id: 12, billing_type: "TimeAndMaterials", stage: 3 },
              { id: 5002, master_cost_center_id: 15, billing_type: "Fixed", stage: 2 },
            ],
          },
          {
            id: 1002,
            name: "Zone 2 – Level 1",
            cost_centers: [
              { id: 5003, master_cost_center_id: 12, billing_type: "TimeAndMaterials", stage: 2 },
              { id: 5004, master_cost_center_id: 15, billing_type: "FlatRate", stage: 2 },
            ],
          },
        ],
      },
    ],
  });
}

export const simproPlugin: ServicePlugin = {
  name: "simpro",
  register(
    app: Hono<AppEnv>,
    store: Store,
    webhooks: WebhookDispatcher,
    baseUrl: string,
    tokenMap?: TokenMap,
  ): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    oauthRoutes(ctx);
    jobRoutes(ctx);
    sectionRoutes(ctx);
    costCenterRoutes(ctx);
    customerRoutes(ctx);
    siteRoutes(ctx);
    staffRoutes(ctx);
    quoteRoutes(ctx);
    invoiceRoutes(ctx);
    scheduleRoutes(ctx);
    assetRoutes(ctx);
    referenceRoutes(ctx);
    webhookRoutes(ctx);
    inspectorRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default simproPlugin;
