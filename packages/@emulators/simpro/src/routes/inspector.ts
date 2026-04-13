import type { RouteContext } from "@emulators/core";
import { escapeHtml, renderSettingsPage } from "@emulators/core";
import { getSimproStore } from "../store.js";

const SERVICE_LABEL = "SimPRO";

function stageBadge(stage: string): string {
  const active = ["Progress", "Active", "Approved"];
  const done = ["Complete", "Paid"];
  const bad = ["Void", "Rejected", "Canceled", "Inactive"];
  const cls = done.includes(stage) ? "badge-granted" : bad.includes(stage) ? "badge-denied" : active.includes(stage) ? "badge-requested" : "badge-requested";
  return `<span class="badge ${cls}">${escapeHtml(stage)}</span>`;
}

function statusBadge(status: string): string {
  const done = ["Paid", "Active", "Approved", "Complete"];
  const bad = ["Void", "Rejected", "Canceled", "Inactive"];
  const warn = ["Issued", "Draft", "Pending", "Progress"];
  const cls = done.includes(status) ? "badge-granted" : bad.includes(status) ? "badge-denied" : "badge-requested";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function inspectorRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  app.get("/", (c) => {
    const tab = c.req.query("tab") ?? "customers";
    const s = ss();

    const customers = s.customers.all();
    const jobs = s.jobs.all();
    const quotes = s.quotes.all();
    const invoices = s.invoices.all();
    const staff = s.staff.all();
    const schedules = s.schedules.all();
    const assets = s.assets.all();
    const costCenters = s.costCenters.all();
    const laborRates = s.laborRates.all();
    const taxCodes = s.taxCodes.all();
    const catalogItems = s.catalogItems.all();

    const sidebar = `
<a href="/?tab=customers"${tab === "customers" ? ' class="active"' : ""}>Customers (${customers.length})</a>
<a href="/?tab=jobs"${tab === "jobs" ? ' class="active"' : ""}>Jobs (${jobs.length})</a>
<a href="/?tab=quotes"${tab === "quotes" ? ' class="active"' : ""}>Quotes (${quotes.length})</a>
<a href="/?tab=invoices"${tab === "invoices" ? ' class="active"' : ""}>Invoices (${invoices.length})</a>
<a href="/?tab=staff"${tab === "staff" ? ' class="active"' : ""}>Staff (${staff.length})</a>
<a href="/?tab=schedules"${tab === "schedules" ? ' class="active"' : ""}>Schedules (${schedules.length})</a>
<a href="/?tab=assets"${tab === "assets" ? ' class="active"' : ""}>Assets (${assets.length})</a>
<a href="/?tab=reference"${tab === "reference" ? ' class="active"' : ""}>Reference</a>`;

    let bodyHtml = "";

    if (tab === "customers") {
      const rows = customers.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No customers yet.</td></tr>`
        : customers.map((cu) => `
<tr>
  <td style="color:#1a8c00">${cu.id}</td>
  <td><span style="color:#33ff00;font-weight:600">${escapeHtml(cu.company_name || `${cu.given_name} ${cu.family_name}`.trim())}</span></td>
  <td>${escapeHtml(cu.type)}</td>
  <td>${escapeHtml(cu.email)}</td>
  <td>${statusBadge(cu.status)}</td>
</tr>`).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Customers</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Email</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "jobs") {
      const rows = jobs.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No jobs yet.</td></tr>`
        : jobs.map((j) => {
          const customer = customers.find((cu) => cu.id === j.customer_id);
          return `
<tr>
  <td style="color:#1a8c00">${j.id}</td>
  <td><code style="color:#33ff00">${escapeHtml(j.order_no)}</code></td>
  <td>${escapeHtml(customer?.company_name ?? String(j.customer_id))}</td>
  <td>${stageBadge(j.stage)}</td>
  <td style="color:#33ff00">${money(j.total_inc_tax)}</td>
</tr>`;
        }).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Jobs</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Order No</th><th>Customer</th><th>Stage</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "quotes") {
      const rows = quotes.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No quotes yet.</td></tr>`
        : quotes.map((q) => {
          const customer = customers.find((cu) => cu.id === q.customer_id);
          return `
<tr>
  <td style="color:#1a8c00">${q.id}</td>
  <td><code style="color:#33ff00">${escapeHtml(q.order_no)}</code></td>
  <td>${escapeHtml(customer?.company_name ?? String(q.customer_id))}</td>
  <td>${stageBadge(q.stage)}</td>
  <td style="color:#33ff00">${money(q.total_inc_tax)}</td>
</tr>`;
        }).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Quotes</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Order No</th><th>Customer</th><th>Stage</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "invoices") {
      const rows = invoices.length === 0
        ? `<tr><td colspan="6" class="inspector-empty">No invoices yet.</td></tr>`
        : invoices.map((inv) => {
          const customer = customers.find((cu) => cu.id === inv.customer_id);
          return `
<tr>
  <td style="color:#1a8c00">${inv.id}</td>
  <td><code style="color:#33ff00">${escapeHtml(inv.invoice_no)}</code></td>
  <td>${escapeHtml(customer?.company_name ?? String(inv.customer_id))}</td>
  <td>${statusBadge(inv.status)}</td>
  <td style="color:#33ff00">${money(inv.total_inc_tax)}</td>
  <td style="color:${inv.balance > 0 ? "#ff4444" : "#1a8c00"}">${money(inv.balance)}</td>
</tr>`;
        }).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Invoices</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Invoice No</th><th>Customer</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "staff") {
      const rows = staff.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No staff yet.</td></tr>`
        : staff.map((m) => `
<tr>
  <td style="color:#1a8c00">${m.id}</td>
  <td><span style="color:#33ff00">${escapeHtml(`${m.given_name} ${m.family_name}`.trim())}</span></td>
  <td>${escapeHtml(m.email)}</td>
  <td>${escapeHtml(m.role_name)}</td>
  <td>${statusBadge(m.status)}</td>
</tr>`).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Staff</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "schedules") {
      const rows = schedules.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No schedules yet.</td></tr>`
        : schedules.map((sched) => {
          const job = jobs.find((j) => j.id === sched.job_id);
          const member = staff.find((m) => m.id === sched.staff_id);
          const blocks = sched.blocks?.map((b) => `${b.start}–${b.end}`).join(", ") || "—";
          return `
<tr>
  <td style="color:#1a8c00">${sched.id}</td>
  <td style="color:#33ff00">${escapeHtml(sched.date)}</td>
  <td><code style="color:#1a8c00">${escapeHtml(job?.order_no ?? String(sched.job_id))}</code></td>
  <td>${escapeHtml(member ? `${member.given_name} ${member.family_name}` : String(sched.staff_id ?? "—"))}</td>
  <td style="font-size:.75rem;color:#1a8c00">${escapeHtml(blocks)}</td>
</tr>`;
        }).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Schedules</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Date</th><th>Job</th><th>Staff</th><th>Blocks</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "assets") {
      const rows = assets.length === 0
        ? `<tr><td colspan="5" class="inspector-empty">No assets yet.</td></tr>`
        : assets.map((a) => {
          const customer = customers.find((cu) => cu.id === a.customer_id);
          return `
<tr>
  <td style="color:#1a8c00">${a.id}</td>
  <td><span style="color:#33ff00">${escapeHtml(a.name)}</span></td>
  <td>${escapeHtml(a.asset_type_name || "—")}</td>
  <td>${escapeHtml(customer?.company_name ?? String(a.customer_id))}</td>
  <td style="color:#1a8c00;font-size:.75rem">${escapeHtml(a.next_service_date || "—")}</td>
</tr>`;
        }).join("");

      bodyHtml = `
<div class="inspector-section">
  <h2>Assets</h2>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Customer</th><th>Next Service</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    if (tab === "reference") {
      bodyHtml = `
<div class="inspector-section">
  <h2>Reference Data</h2>
  <table class="inspector-table">
    <thead><tr><th>Collection</th><th>Count</th></tr></thead>
    <tbody>
      <tr><td>Cost Centers</td><td style="color:#33ff00">${costCenters.length}</td></tr>
      <tr><td>Labor Rates</td><td style="color:#33ff00">${laborRates.length}</td></tr>
      <tr><td>Tax Codes</td><td style="color:#33ff00">${taxCodes.length}</td></tr>
      <tr><td>Catalog Items</td><td style="color:#33ff00">${catalogItems.length}</td></tr>
      <tr><td>Zones</td><td style="color:#33ff00">${s.zones.all().length}</td></tr>
      <tr><td>Statuses</td><td style="color:#33ff00">${s.statuses.all().length}</td></tr>
      <tr><td>Custom Fields</td><td style="color:#33ff00">${s.customFields.all().length}</td></tr>
      <tr><td>Webhooks</td><td style="color:#33ff00">${s.webhooks.all().length}</td></tr>
    </tbody>
  </table>
  ${costCenters.length > 0 ? `
  <h3 style="margin-top:1.5rem">Cost Centers</h3>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th></tr></thead>
    <tbody>${costCenters.map((cc) => `<tr><td style="color:#1a8c00">${cc.id}</td><td>${escapeHtml(cc.name)}</td></tr>`).join("")}</tbody>
  </table>` : ""}
  ${laborRates.length > 0 ? `
  <h3 style="margin-top:1.5rem">Labor Rates</h3>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th><th>Rate</th></tr></thead>
    <tbody>${laborRates.map((lr) => `<tr><td style="color:#1a8c00">${lr.id}</td><td>${escapeHtml(lr.name)}</td><td style="color:#33ff00">$${lr.rate}/hr</td></tr>`).join("")}</tbody>
  </table>` : ""}
  ${taxCodes.length > 0 ? `
  <h3 style="margin-top:1.5rem">Tax Codes</h3>
  <table class="inspector-table">
    <thead><tr><th>ID</th><th>Name</th><th>Rate</th></tr></thead>
    <tbody>${taxCodes.map((tc) => `<tr><td style="color:#1a8c00">${tc.id}</td><td>${escapeHtml(tc.name)}</td><td style="color:#33ff00">${tc.rate}%</td></tr>`).join("")}</tbody>
  </table>` : ""}
</div>`;
    }

    const stats = `${customers.length} customers · ${jobs.length} jobs · ${invoices.length} invoices · ${assets.length} assets`;
    return c.html(
      renderSettingsPage(
        "SimPRO Inspector",
        sidebar,
        `<div class="s-card">
  <div class="s-card-header">
    <div class="s-icon">S</div>
    <div>
      <div class="s-title">SimPRO Field Service</div>
      <div class="s-subtitle">${stats}</div>
    </div>
  </div>
  ${bodyHtml}
</div>`,
        SERVICE_LABEL,
      ),
    );
  });
}
