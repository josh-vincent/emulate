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
import { contactRoutes } from "./routes/contacts.js";
import { contractorRoutes } from "./routes/contractors.js";
import { attachmentRoutes } from "./routes/attachments.js";
import type { SimproAttachmentParentType } from "./entities.js";

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
    description?: string | null;
    customer_id: number;
    site_id?: number | null;
    stage?: JobStage;
    order_no?: string | null;
    project_manager_id?: number | null;
    salesperson_id?: number | null;
    status_id?: number | null;
    date_issued?: string | null;
    due_date?: string | null;
    total_ex_tax?: number;
    total_tax?: number;
    total_inc_tax?: number;
    sections?: Array<{
      id: number;
      name: string;
      description?: string | null;
      cost_centers?: Array<{
        id: number;
        master_cost_center_id?: number | null;
        tax_code_id?: number | null;
        name?: string;
        description?: string | null;
        billing_type?: BillingType;
        stage?: CostCenterStage;
        ex_tax?: number;
        inc_tax?: number;
      }>;
    }>;
  }>;
  quotes?: Array<{
    id: number;
    company_id?: number;
    name: string;
    description?: string | null;
    order_no?: string | null;
    customer_id: number;
    site_id?: number | null;
    salesperson_id?: number | null;
    project_manager_id?: number | null;
    status_id?: number | null;
    stage?: "Open" | "Approved" | "Converted" | "Cancelled";
    total_ex_tax?: number;
    total_tax?: number;
    total_inc_tax?: number;
    date_issued?: string | null;
    due_date?: string | null;
    tags?: string[];
    converted_job_id?: number | null;
  }>;
  assets?: Array<{
    id: number;
    company_id?: number;
    customer_id: number;
    site_id?: number | null;
    name: string;
    description?: string | null;
    asset_type?: string | null;
    serial_number?: string | null;
    status?: string | null;
    notes?: string | null;
    date_installed?: string | null;
    date_next_service?: string | null;
  }>;
  invoices?: Array<{
    id: number;
    company_id?: number;
    job_id: number;
    type?: "TaxInvoice" | "ProgressClaim" | "CreditNote";
    stage?: 2 | 5;
    total_ex_tax?: number;
    total_inc_tax?: number;
    paid?: number;
    date_issued?: string | null;
  }>;
  contacts?: Array<{
    id: number;
    company_id?: number;
    type?: "Customer" | "Site";
    customer_id?: number | null;
    site_id?: number | null;
    salutation?: string | null;
    given_name: string;
    family_name: string;
    position?: string | null;
    department?: string | null;
    email?: string | null;
    alt_email?: string | null;
    phone?: string | null;
    cell_phone?: string | null;
    fax?: string | null;
    primary_contact?: boolean;
    archived?: boolean;
  }>;
  contractors?: Array<{
    id: number;
    company_id?: number;
    company_name?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    email?: string | null;
    phone?: string | null;
    cell_phone?: string | null;
    fax?: string | null;
    archived?: boolean;
  }>;
  schedules?: Array<{
    id: number;
    company_id?: number;
    job_id: number;
    section_id?: number | null;
    cost_center_id?: number | null;
    technician_id: number;
    date: string;
    start_time: string;
    duration_minutes: number;
  }>;
  stock_items?: Array<{
    id: number;
    company_id?: number;
    name: string;
    part_no: string;
    description?: string | null;
    group_name?: string | null;
    subgroup_name?: string | null;
    unit_of_measure?: string | null;
    trade_price_ex_tax?: number;
    trade_price_inc_tax?: number;
    unit_price?: number;
    tax_code_id?: number | null;
    supplier_id?: number | null;
    supplier_name?: string | null;
    supplier_part_no?: string | null;
    taxable?: boolean;
    archived?: boolean;
  }>;
  attachments?: Array<{
    id: number;
    company_id?: number;
    parent_type: SimproAttachmentParentType;
    parent_id: number;
    filename: string;
    description?: string | null;
    mime_type?: string | null;
    size?: number;
    url?: string;
    date_added?: string;
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
      description: job.description ?? null,
      order_no: job.order_no ?? null,
      request_no: null,
      customer_id: job.customer_id,
      customer_contact_id: null,
      site_id: job.site_id ?? null,
      site_contact_id: null,
      salesperson_id: job.salesperson_id ?? null,
      project_manager_id: job.project_manager_id ?? null,
      technician_ids: [] as number[],
      stage: job.stage ?? 2,
      status_id: job.status_id ?? null,
      date_issued: job.date_issued ?? now.slice(0, 10),
      due_date: job.due_date ?? null,
      due_time: null,
      tags: [] as string[],
      custom_fields: [],
      total_ex_tax: job.total_ex_tax ?? 0,
      total_tax: job.total_tax ?? 0,
      total_inc_tax: job.total_inc_tax ?? 0,
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
          description: cc.description ?? null,
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

  for (const q of config.quotes ?? []) {
    const quoteRow = {
      company_id: q.company_id ?? DEFAULT_COMPANY_ID,
      external_id: q.id,
      name: q.name,
      description: q.description ?? null,
      order_no: q.order_no ?? null,
      customer_id: q.customer_id,
      customer_contact_id: null,
      site_id: q.site_id ?? null,
      site_contact_id: null,
      salesperson_id: q.salesperson_id ?? null,
      project_manager_id: q.project_manager_id ?? null,
      status_id: q.status_id ?? null,
      stage: q.stage ?? "Open",
      total_ex_tax: q.total_ex_tax ?? 0,
      total_tax: q.total_tax ?? 0,
      total_inc_tax: q.total_inc_tax ?? 0,
      date_issued: q.date_issued ?? now.slice(0, 10),
      due_date: q.due_date ?? null,
      tags: q.tags ?? [],
      converted_job_id: q.converted_job_id ?? null,
      date_modified: now,
    };
    const existingQuote = ss.quotes.findOneBy("external_id", q.id);
    if (existingQuote) ss.quotes.update(existingQuote.id, quoteRow);
    else ss.quotes.insert(quoteRow);
  }

  for (const a of config.assets ?? []) {
    const assetRow = {
      company_id: a.company_id ?? DEFAULT_COMPANY_ID,
      external_id: a.id,
      customer_id: a.customer_id,
      site_id: a.site_id ?? null,
      name: a.name,
      description: a.description ?? null,
      asset_type: a.asset_type ?? null,
      serial_number: a.serial_number ?? null,
      status: a.status ?? null,
      notes: a.notes ?? null,
      date_installed: a.date_installed ?? null,
      date_next_service: a.date_next_service ?? null,
      date_modified: now,
    };
    const existingAsset = ss.assets.findOneBy("external_id", a.id);
    if (existingAsset) ss.assets.update(existingAsset.id, assetRow);
    else ss.assets.insert(assetRow);
  }

  for (const inv of config.invoices ?? []) {
    const invRow = {
      company_id: inv.company_id ?? DEFAULT_COMPANY_ID,
      external_id: inv.id,
      job_id: inv.job_id,
      type: inv.type ?? "TaxInvoice",
      stage: inv.stage ?? 2,
      total_ex_tax: inv.total_ex_tax ?? 0,
      total_inc_tax: inv.total_inc_tax ?? 0,
      paid: inv.paid ?? 0,
      date_issued: inv.date_issued ?? now.slice(0, 10),
    };
    const existingInv = ss.invoices.findOneBy("external_id", inv.id);
    if (existingInv) ss.invoices.update(existingInv.id, invRow);
    else ss.invoices.insert(invRow);
  }

  for (const ct of config.contacts ?? []) {
    const row = {
      company_id: ct.company_id ?? DEFAULT_COMPANY_ID,
      external_id: ct.id,
      type: ct.type ?? "Customer",
      customer_id: ct.customer_id ?? null,
      site_id: ct.site_id ?? null,
      salutation: ct.salutation ?? null,
      given_name: ct.given_name,
      family_name: ct.family_name,
      position: ct.position ?? null,
      department: ct.department ?? null,
      email: ct.email ?? null,
      alt_email: ct.alt_email ?? null,
      phone: ct.phone ?? null,
      cell_phone: ct.cell_phone ?? null,
      fax: ct.fax ?? null,
      primary_contact: ct.primary_contact ?? false,
      archived: ct.archived ?? false,
    };
    const existing = ss.contacts.findOneBy("external_id", ct.id);
    if (existing) ss.contacts.update(existing.id, row);
    else ss.contacts.insert(row);
  }

  for (const cr of config.contractors ?? []) {
    const row = {
      company_id: cr.company_id ?? DEFAULT_COMPANY_ID,
      external_id: cr.id,
      company_name: cr.company_name ?? null,
      given_name: cr.given_name ?? null,
      family_name: cr.family_name ?? null,
      email: cr.email ?? null,
      phone: cr.phone ?? null,
      cell_phone: cr.cell_phone ?? null,
      fax: cr.fax ?? null,
      address: null,
      archived: cr.archived ?? false,
    };
    const existing = ss.contractors.findOneBy("external_id", cr.id);
    if (existing) ss.contractors.update(existing.id, row);
    else ss.contractors.insert(row);
  }

  for (const sc of config.schedules ?? []) {
    const row = {
      company_id: sc.company_id ?? DEFAULT_COMPANY_ID,
      external_id: sc.id,
      job_id: sc.job_id,
      section_id: sc.section_id ?? null,
      cost_center_id: sc.cost_center_id ?? null,
      technician_id: sc.technician_id,
      date: sc.date,
      start_time: sc.start_time,
      duration_minutes: sc.duration_minutes,
    };
    const existing = ss.schedules.findOneBy("external_id", sc.id);
    if (existing) ss.schedules.update(existing.id, row);
    else ss.schedules.insert(row);
  }

  for (const at of config.attachments ?? []) {
    const row = {
      company_id: at.company_id ?? DEFAULT_COMPANY_ID,
      external_id: at.id,
      parent_type: at.parent_type,
      parent_id: at.parent_id,
      filename: at.filename,
      description: at.description ?? null,
      mime_type: at.mime_type ?? null,
      size: at.size ?? 0,
      url:
        at.url ??
        `https://emulator.local/attachments/${at.parent_type}/${at.parent_id}/${at.id}`,
      date_added: at.date_added ?? now,
    };
    const existing = ss.attachments
      .all()
      .find(
        (a) =>
          a.parent_type === at.parent_type &&
          a.parent_id === at.parent_id &&
          a.external_id === at.id,
      );
    if (existing) ss.attachments.update(existing.id, row);
    else ss.attachments.insert(row);
  }

  for (const si of config.stock_items ?? []) {
    const row = {
      company_id: si.company_id ?? DEFAULT_COMPANY_ID,
      external_id: si.id,
      name: si.name,
      part_no: si.part_no,
      description: si.description ?? null,
      group_name: si.group_name ?? null,
      subgroup_name: si.subgroup_name ?? null,
      trade_price_ex_tax: si.trade_price_ex_tax ?? 0,
      trade_price_inc_tax:
        si.trade_price_inc_tax ?? si.trade_price_ex_tax ?? 0,
      unit_price: si.unit_price ?? si.trade_price_ex_tax ?? 0,
      unit_of_measure: si.unit_of_measure ?? null,
      tax_code_id: si.tax_code_id ?? null,
      supplier_id: si.supplier_id ?? null,
      supplier_name: si.supplier_name ?? null,
      supplier_part_no: si.supplier_part_no ?? null,
      taxable: si.taxable ?? true,
      archived: si.archived ?? false,
    };
    const existing = ss.stockItems.findOneBy("external_id", si.id);
    if (existing) ss.stockItems.update(existing.id, row);
    else ss.stockItems.insert(row);
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
    attachments: [
      {
        id: 9001,
        parent_type: "job",
        parent_id: 12345,
        filename: "sprinkler-scope.pdf",
        description: "Scope of works",
        mime_type: "application/pdf",
        size: 184_320,
      },
      {
        id: 9002,
        parent_type: "customer",
        parent_id: 200,
        filename: "acme-master-service-agreement.pdf",
        description: "MSA (signed)",
        mime_type: "application/pdf",
        size: 231_000,
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
    contactRoutes(ctx);
    contractorRoutes(ctx);
    attachmentRoutes(ctx);
    webhookRoutes(ctx);
    inspectorRoutes(ctx);
  },
  seed(store: Store, baseUrl: string): void {
    seedDefaults(store, baseUrl);
  },
};

export default simproPlugin;
