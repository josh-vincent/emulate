import type { Context } from "hono";
import type { RouteContext } from "@emulators/core";
import { escapeHtml, renderInspectorPage, type InspectorTab } from "@emulators/core";
import { getSimproStore } from "../store.js";

// Routes and hrefs are service-relative. The multi-service dispatcher strips
// the `/simpro` segment before forwarding and re-prefixes outbound Location
// headers + HTML href/action attributes, so hardcoding `/simpro` here would
// make the inspector unreachable when mounted at /simpro/* (the default).
const TABS: InspectorTab[] = [
  { id: "customers", label: "Customers", href: "/inspector/customers" },
  { id: "jobs", label: "Jobs", href: "/inspector/jobs" },
  { id: "sections", label: "Sections", href: "/inspector/sections" },
  { id: "costCenters", label: "Cost Centers", href: "/inspector/cost-centers" },
  { id: "invoices", label: "Invoices", href: "/inspector/invoices" },
  { id: "webhooks", label: "Webhooks", href: "/inspector/webhooks" },
];

const table = (headers: string[], rows: string[][]): string => {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<table class="inspector-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

export function inspectorRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const render = (active: string, body: string, c: Context) =>
    c.html(renderInspectorPage("Simpro Emulator", TABS, active, body, "simpro"));

  app.get("/", (c) => c.redirect("/inspector/customers"));

  app.get("/inspector/customers", (c) => {
    const rows = ss.customers
      .all()
      .map((cust) => [
        String(cust.external_id),
        cust.type,
        cust.company_name ?? `${cust.given_name ?? ""} ${cust.family_name ?? ""}`.trim(),
        cust.email ?? "",
        cust.archived ? "yes" : "no",
      ]);
    return render("customers", table(["ID", "Type", "Name", "Email", "Archived"], rows), c);
  });

  app.get("/inspector/jobs", (c) => {
    const rows = ss.jobs
      .all()
      .map((j) => [String(j.external_id), j.type, j.name, String(j.stage), j.order_no ?? "", String(j.total_ex_tax)]);
    return render("jobs", table(["ID", "Type", "Name", "Stage", "OrderNo", "ExTax"], rows), c);
  });

  app.get("/inspector/sections", (c) => {
    const rows = ss.sections
      .all()
      .map((s) => [String(s.external_id), String(s.job_id), s.name, String(s.display_order)]);
    return render("sections", table(["ID", "Job", "Name", "Order"], rows), c);
  });

  app.get("/inspector/cost-centers", (c) => {
    const rows = ss.costCenters
      .all()
      .map((cc) => [
        String(cc.external_id),
        String(cc.job_id),
        String(cc.section_id),
        cc.name,
        cc.billing_type,
        String(cc.stage),
        String(cc.ex_tax),
      ]);
    return render("costCenters", table(["ID", "Job", "Section", "Name", "Billing", "Stage", "ExTax"], rows), c);
  });

  app.get("/inspector/invoices", (c) => {
    const rows = ss.invoices
      .all()
      .map((i) => [
        String(i.external_id),
        String(i.job_id),
        i.type,
        String(i.stage),
        String(i.total_ex_tax),
        String(i.paid),
      ]);
    return render("invoices", table(["ID", "Job", "Type", "Stage", "ExTax", "Paid"], rows), c);
  });

  app.get("/inspector/webhooks", (c) => {
    const subRows = ss.webhookSubscriptions
      .all()
      .map((w) => [String(w.external_id), w.url, w.events.join(", "), w.active ? "yes" : "no"]);
    const evRows = ss.webhookEvents.all().map((e) => [String(e.id), e.event, String(e.entity_id), e.status]);
    const body = `
      <h3>Subscriptions</h3>
      ${table(["ID", "URL", "Events", "Active"], subRows)}
      <h3 style="margin-top:24px">Recent Events</h3>
      ${table(["ID", "Event", "Entity", "Status"], evRows)}
    `;
    return render("webhooks", body, c);
  });
}
