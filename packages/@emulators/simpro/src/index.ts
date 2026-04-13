import type { Hono } from "hono";
import type { AppEnv, RouteContext, ServicePlugin, Store, TokenMap, WebhookDispatcher } from "@emulators/core";
import { getSimproStore } from "./store.js";
import { assetRoutes } from "./routes/assets.js";
import { contractorRoutes } from "./routes/contractors.js";
import { customerRoutes } from "./routes/customers.js";
import { inspectorRoutes } from "./routes/inspector.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { jobRoutes } from "./routes/jobs.js";
import { oauthRoutes } from "./routes/oauth.js";
import { quoteRoutes } from "./routes/quotes.js";
import { referenceRoutes } from "./routes/reference.js";
import { scheduleRoutes } from "./routes/schedules.js";
import { siteRoutes } from "./routes/sites.js";
import { staffRoutes } from "./routes/staff.js";

export { getSimproStore, type SimproStore } from "./store.js";
export * from "./entities.js";

export interface SimproSeedConfig {
  customers?: Array<{
    type?: "Company" | "Individual";
    company_name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    phone1?: string;
    mobile?: string;
    mail_address?: string;
    mail_suburb?: string;
    mail_state?: string;
    mail_postcode?: string;
    mail_country?: string;
    payment_term?: number;
    status?: "Active" | "Inactive";
  }>;
  sites?: Array<{
    customer_email?: string;
    customer_name?: string;
    name: string;
    address?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
  }>;
  staff?: Array<{
    given_name: string;
    family_name: string;
    email?: string;
    phone?: string;
    mobile?: string;
    role_name?: string;
    status?: "Active" | "Inactive";
  }>;
  jobs?: Array<{
    order_no?: string;
    description: string;
    customer_email?: string;
    customer_name?: string;
    site_name?: string;
    stage?: "Pending" | "Progress" | "Complete" | "Void";
    issued_date?: string;
    due_date?: string;
    total_ex_tax?: number;
    total_inc_tax?: number;
  }>;
  quotes?: Array<{
    order_no?: string;
    description: string;
    customer_email?: string;
    customer_name?: string;
    stage?: "Pending" | "Approved" | "Rejected" | "Converted";
    issued_date?: string;
    due_date?: string;
    total_ex_tax?: number;
    total_inc_tax?: number;
  }>;
  invoices?: Array<{
    invoice_no?: string;
    customer_email?: string;
    customer_name?: string;
    job_order_no?: string;
    status?: "Draft" | "Issued" | "Paid" | "Void";
    total_ex_tax?: number;
    total_inc_tax?: number;
    amount_paid?: number;
    issued_date?: string;
    due_date?: string;
  }>;
  schedules?: Array<{
    job_order_no: string;
    staff_email?: string;
    staff_given_name?: string;
    staff_family_name?: string;
    date: string;
    blocks?: Array<{ start: string; end: string }>;
    notes?: string;
  }>;
  assets?: Array<{
    name: string;
    asset_type_name?: string;
    customer_email?: string;
    customer_name?: string;
    site_name?: string;
    serial_no?: string;
    service_level_name?: string;
    next_service_date?: string;
    date_installed?: string;
    status?: string;
  }>;
  cost_centers?: Array<{ name: string; description?: string }>;
  labor_rates?: Array<{ name: string; rate: number }>;
  tax_codes?: Array<{ name: string; rate: number; description?: string }>;
  catalog_items?: Array<{ name: string; part_no?: string; unit_price: number; description?: string }>;
  zones?: Array<{ name: string; description?: string }>;
}

export function seedFromConfig(store: Store, _baseUrl: string, config: SimproSeedConfig): void {
  const ss = getSimproStore(store);

  // 1. Reference data
  for (const cc of config.cost_centers ?? []) {
    if (!ss.costCenters.all().find((c) => c.name === cc.name)) {
      ss.costCenters.insert({ name: cc.name, description: cc.description ?? "" });
    }
  }
  for (const lr of config.labor_rates ?? []) {
    if (!ss.laborRates.all().find((l) => l.name === lr.name)) {
      ss.laborRates.insert({ name: lr.name, rate: lr.rate });
    }
  }
  for (const tc of config.tax_codes ?? []) {
    if (!ss.taxCodes.all().find((t) => t.name === tc.name)) {
      ss.taxCodes.insert({ name: tc.name, rate: tc.rate, description: tc.description ?? "" });
    }
  }
  for (const ci of config.catalog_items ?? []) {
    if (!ss.catalogItems.all().find((c) => c.name === ci.name)) {
      ss.catalogItems.insert({
        name: ci.name,
        part_no: ci.part_no ?? "",
        unit_price: ci.unit_price,
        cost_center_id: null,
        description: ci.description ?? "",
      });
    }
  }
  for (const z of config.zones ?? []) {
    if (!ss.zones.all().find((zn) => zn.name === z.name)) {
      ss.zones.insert({ name: z.name, description: z.description ?? "" });
    }
  }

  // 2. Staff
  for (const s of config.staff ?? []) {
    const existing = s.email ? ss.staff.findOneBy("email", s.email) : undefined;
    if (existing) continue;
    ss.staff.insert({
      given_name: s.given_name,
      family_name: s.family_name,
      email: s.email ?? "",
      phone: s.phone ?? "",
      mobile: s.mobile ?? "",
      role_id: null,
      role_name: s.role_name ?? "",
      status: s.status ?? "Active",
    });
  }

  // 3. Customers
  for (const cu of config.customers ?? []) {
    const lookupEmail = cu.email ?? "";
    const existing = lookupEmail ? ss.customers.findOneBy("email", lookupEmail) : undefined;
    if (existing) continue;
    ss.customers.insert({
      type: cu.type ?? "Company",
      company_name: cu.company_name ?? "",
      given_name: cu.given_name ?? "",
      family_name: cu.family_name ?? "",
      phone1: cu.phone1 ?? "",
      phone2: "",
      mobile: cu.mobile ?? "",
      fax: "",
      email: cu.email ?? "",
      tax_number: "",
      mail_address: cu.mail_address ?? "",
      mail_suburb: cu.mail_suburb ?? "",
      mail_state: cu.mail_state ?? "",
      mail_postcode: cu.mail_postcode ?? "",
      mail_country: cu.mail_country ?? "Australia",
      payment_term: cu.payment_term ?? 30,
      payment_term_type: "Day",
      status: cu.status ?? "Active",
      custom_fields: [],
    });
  }

  // 4. Sites
  for (const site of config.sites ?? []) {
    const customer = site.customer_email
      ? ss.customers.findOneBy("email", site.customer_email)
      : ss.customers.all().find((c) => c.company_name === site.customer_name);

    if (!customer) {
      console.warn(`[simpro] seedFromConfig: site "${site.name}" — customer not found (${site.customer_email ?? site.customer_name}), skipping`);
      continue;
    }

    const existing = ss.sites.findBy("customer_id", customer.id).find((s) => s.name === site.name);
    if (existing) continue;

    ss.sites.insert({
      customer_id: customer.id,
      name: site.name,
      address: site.address ?? "",
      suburb: site.suburb ?? "",
      state: site.state ?? "",
      postcode: site.postcode ?? "",
      country: site.country ?? "Australia",
      contact_name: site.contact_name ?? "",
      contact_phone: site.contact_phone ?? "",
      contact_email: site.contact_email ?? "",
    });
  }

  // 5. Jobs
  for (const j of config.jobs ?? []) {
    if (j.order_no && ss.jobs.all().find((job) => job.order_no === j.order_no)) continue;

    const customer = j.customer_email
      ? ss.customers.findOneBy("email", j.customer_email)
      : ss.customers.all().find((c) => c.company_name === j.customer_name);

    if (!customer && (j.customer_email || j.customer_name)) {
      console.warn(`[simpro] seedFromConfig: job "${j.description}" — customer not found, skipping`);
      continue;
    }

    const site = j.site_name && customer
      ? ss.sites.findBy("customer_id", customer.id).find((s) => s.name === j.site_name)
      : null;

    ss.jobs.insert({
      type: "Job",
      order_no: j.order_no ?? `J-${new Date().getFullYear()}-${String(ss.jobs.all().length + 1).padStart(3, "0")}`,
      description: j.description,
      customer_id: customer?.id ?? 0,
      site_id: site?.id ?? null,
      stage: j.stage ?? "Pending",
      status_id: null,
      issued_date: j.issued_date ?? new Date().toISOString(),
      due_date: j.due_date ?? "",
      total_ex_tax: j.total_ex_tax ?? 0,
      total_inc_tax: j.total_inc_tax ?? (j.total_ex_tax ? j.total_ex_tax * 1.1 : 0),
      sections: [],
      tags: [],
    });
  }

  // 6. Quotes
  for (const q of config.quotes ?? []) {
    if (q.order_no && ss.quotes.all().find((qt) => qt.order_no === q.order_no)) continue;

    const customer = q.customer_email
      ? ss.customers.findOneBy("email", q.customer_email)
      : ss.customers.all().find((c) => c.company_name === q.customer_name);

    if (!customer && (q.customer_email || q.customer_name)) {
      console.warn(`[simpro] seedFromConfig: quote "${q.description}" — customer not found, skipping`);
      continue;
    }

    ss.quotes.insert({
      order_no: q.order_no ?? `Q-${new Date().getFullYear()}-${String(ss.quotes.all().length + 1).padStart(3, "0")}`,
      description: q.description,
      customer_id: customer?.id ?? 0,
      site_id: null,
      stage: q.stage ?? "Pending",
      status_id: null,
      issued_date: q.issued_date ?? new Date().toISOString(),
      due_date: q.due_date ?? "",
      total_ex_tax: q.total_ex_tax ?? 0,
      total_inc_tax: q.total_inc_tax ?? (q.total_ex_tax ? q.total_ex_tax * 1.1 : 0),
      converted_job_id: null,
    });
  }

  // 7. Invoices
  for (const inv of config.invoices ?? []) {
    if (inv.invoice_no && ss.invoices.all().find((i) => i.invoice_no === inv.invoice_no)) continue;

    const customer = inv.customer_email
      ? ss.customers.findOneBy("email", inv.customer_email)
      : ss.customers.all().find((c) => c.company_name === inv.customer_name);

    if (!customer && (inv.customer_email || inv.customer_name)) {
      console.warn(`[simpro] seedFromConfig: invoice "${inv.invoice_no}" — customer not found, skipping`);
      continue;
    }

    const job = inv.job_order_no
      ? ss.jobs.all().find((j) => j.order_no === inv.job_order_no)
      : null;

    const totalExTax = inv.total_ex_tax ?? 0;
    const totalIncTax = inv.total_inc_tax ?? totalExTax * 1.1;
    const amountPaid = inv.amount_paid ?? 0;

    ss.invoices.insert({
      invoice_no: inv.invoice_no ?? `INV-${new Date().getFullYear()}-${String(ss.invoices.all().length + 1).padStart(3, "0")}`,
      customer_id: customer?.id ?? 0,
      job_id: job?.id ?? null,
      status: inv.status ?? "Draft",
      total_ex_tax: totalExTax,
      total_inc_tax: totalIncTax,
      amount_paid: amountPaid,
      balance: totalIncTax - amountPaid,
      issued_date: inv.issued_date ?? new Date().toISOString(),
      due_date: inv.due_date ?? "",
    });
  }

  // 8. Schedules
  for (const sched of config.schedules ?? []) {
    const job = ss.jobs.all().find((j) => j.order_no === sched.job_order_no);
    if (!job) {
      console.warn(`[simpro] seedFromConfig: schedule for job "${sched.job_order_no}" — job not found, skipping`);
      continue;
    }

    const staffMember = sched.staff_email
      ? ss.staff.findOneBy("email", sched.staff_email)
      : sched.staff_given_name && sched.staff_family_name
        ? ss.staff.all().find((m) => m.given_name === sched.staff_given_name && m.family_name === sched.staff_family_name)
        : null;

    ss.schedules.insert({
      job_id: job.id,
      cost_center_id: null,
      cost_center_name: "",
      staff_id: staffMember?.id ?? null,
      date: sched.date,
      blocks: sched.blocks ?? [{ start: "08:00", end: "16:00" }],
      notes: sched.notes ?? "",
    });
  }

  // 9. Assets
  for (const a of config.assets ?? []) {
    const customer = a.customer_email
      ? ss.customers.findOneBy("email", a.customer_email)
      : ss.customers.all().find((c) => c.company_name === a.customer_name);

    if (!customer && (a.customer_email || a.customer_name)) {
      console.warn(`[simpro] seedFromConfig: asset "${a.name}" — customer not found, skipping`);
      continue;
    }

    const site = a.site_name && customer
      ? ss.sites.findBy("customer_id", customer.id).find((s) => s.name === a.site_name)
      : null;

    const duplicate = customer
      ? ss.assets.findBy("customer_id", customer.id).find((asset) => asset.name === a.name && asset.serial_no === (a.serial_no ?? ""))
      : false;
    if (duplicate) continue;

    ss.assets.insert({
      name: a.name,
      asset_type_id: null,
      asset_type_name: a.asset_type_name ?? "",
      customer_id: customer?.id ?? 0,
      site_id: site?.id ?? null,
      serial_no: a.serial_no ?? "",
      service_level_id: null,
      service_level_name: a.service_level_name ?? "",
      next_service_date: a.next_service_date ?? "",
      status: a.status ?? "Active",
      date_installed: a.date_installed ?? "",
      custom_fields: [],
    });
  }
}

export const simproPlugin: ServicePlugin = {
  name: "simpro",
  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string, tokenMap?: TokenMap): void {
    const ctx: RouteContext = { app, store, webhooks, baseUrl, tokenMap };
    // Health check — used by dev-emulate.sh wait loop
    app.get("/health", (c) => c.json({ status: "ok", service: "simpro" }));
    oauthRoutes(ctx);
    inspectorRoutes(ctx);
    referenceRoutes(ctx);
    customerRoutes(ctx);
    siteRoutes(ctx);
    staffRoutes(ctx);
    contractorRoutes(ctx);
    jobRoutes(ctx);
    quoteRoutes(ctx);
    invoiceRoutes(ctx);
    scheduleRoutes(ctx);
    assetRoutes(ctx);
  },
  seed(_store: Store, _baseUrl: string): void {
    // No hardcoded defaults — all data is config-driven
  },
};

export default simproPlugin;
