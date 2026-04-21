import type { Context } from "hono";
import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  nowIso,
  paginate,
  parseJson,
  parsePagination,
  rateLimit,
  requireAuth,
  simproError,
  simproNotFound,
  simproValidation,
} from "../helpers.js";
import { formatPayment } from "../formatters.js";
import { nextExternalId } from "./jobs.js";

export function paymentRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/customerPayments/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.customerPayments.all().filter((p) => p.company_id === companyId || companyId === 0);
    const customerId = c.req.query("Customer.ID");
    if (customerId) items = items.filter((p) => p.customer_id === Number(customerId));
    const invoiceId = c.req.query("Invoice.ID");
    if (invoiceId) items = items.filter((p) => p.invoice_id === Number(invoiceId));
    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map((p) => formatPayment(p)));
  });

  app.get("/api/v1.0/companies/:cid/customerPayments/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const p = ss.customerPayments.findOneBy("external_id", Number(c.req.param("id")));
    if (!p) return simproNotFound(c);
    return c.json(formatPayment(p));
  });

  app.post("/api/v1.0/companies/:cid/customerPayments/", async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    let body: Record<string, unknown>;
    try { body = await parseJson(c); } catch { return simproError(c, 400, "Problems parsing JSON."); }

    const customerRef = body.Customer as { ID?: number } | undefined;
    if (!customerRef?.ID) return simproValidation(c, "Customer.ID", "Customer is required.");
    const customer = ss.customers.findOneBy("external_id", customerRef.ID);
    if (!customer) return simproValidation(c, "Customer.ID", "Customer not found.", customerRef.ID);

    const amount = Number(body.Amount ?? 0);
    if (!amount) return simproValidation(c, "Amount", "Amount is required and must be non-zero.");

    const invoiceRef = body.Invoice as { ID?: number } | undefined;
    const companyId = Number(c.req.param("cid")) || 0;
    const externalId = nextExternalId(ss, "customerPayments", companyId);
    const now = nowIso();

    const payment = ss.customerPayments.insert({
      company_id: companyId,
      external_id: externalId,
      customer_id: customerRef.ID,
      invoice_id: invoiceRef?.ID ?? null,
      amount,
      date: (body.Date as string) ?? now.slice(0, 10),
      payment_method: (body.PaymentMethod as string | null) ?? null,
      notes: (body.Notes as string | null) ?? null,
      date_created: now,
      date_modified: now,
    });

    // Update invoice.paid if linked
    if (invoiceRef?.ID) {
      const inv = ss.invoices.findOneBy("external_id", invoiceRef.ID);
      if (inv) ss.invoices.update(inv.id, { paid: inv.paid + amount });
    }

    return c.json(formatPayment(payment), 201);
  });

  app.patch("/api/v1.0/companies/:cid/customerPayments/:id", async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const p = ss.customerPayments.findOneBy("external_id", Number(c.req.param("id")));
    if (!p) return simproNotFound(c);
    let body: Record<string, unknown>;
    try { body = await parseJson(c); } catch { return simproError(c, 400, "Problems parsing JSON."); }
    const updated = ss.customerPayments.update(p.id, {
      ...(body.Amount !== undefined && { amount: Number(body.Amount) }),
      ...(body.Date !== undefined && { date: body.Date as string }),
      ...(body.PaymentMethod !== undefined && { payment_method: body.PaymentMethod as string | null }),
      ...(body.Notes !== undefined && { notes: body.Notes as string | null }),
      date_modified: nowIso(),
    })!;
    return c.json(formatPayment(updated));
  });

  app.delete("/api/v1.0/companies/:cid/customerPayments/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const p = ss.customerPayments.findOneBy("external_id", Number(c.req.param("id")));
    if (!p) return simproNotFound(c);
    // Reverse invoice.paid if linked
    if (p.invoice_id) {
      const inv = ss.invoices.findOneBy("external_id", p.invoice_id);
      if (inv) ss.invoices.update(inv.id, { paid: Math.max(0, inv.paid - p.amount) });
    }
    ss.customerPayments.delete(p.id);
    return c.body(null, 204);
  });
}
