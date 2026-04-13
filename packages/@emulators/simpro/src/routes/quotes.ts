import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
  nextQuoteOrderNo,
  nextJobOrderNo,
} from "../helpers.js";
import { formatQuote, formatJob } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function quoteRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List quotes — filter: Customer.ID, Stage
  app.get(`${C}/quotes/`, (c) => {
    const customerIdStr = c.req.query("Customer.ID");
    const stageFilter = c.req.query("Stage");

    let quotes = ss().quotes.all();
    if (customerIdStr) {
      const custId = parseInt(customerIdStr, 10);
      if (!isNaN(custId)) quotes = quotes.filter((q) => q.customer_id === custId);
    }
    if (stageFilter) quotes = quotes.filter((q) => q.stage === stageFilter);

    const s = ss();
    return simproPaginate(c, quotes, (q) => formatQuote(q, s));
  });

  // Create quote
  app.post(`${C}/quotes/`, async (c) => {
    const body = await parseSimproBody(c);
    const s = ss();

    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;

    const custId = customerRef?.ID ? parseInt(String(customerRef.ID), 10) : 0;
    const siteId = siteRef?.ID ? parseInt(String(siteRef.ID), 10) : null;

    const quote = s.quotes.insert({
      order_no: (body.OrderNo as string) || nextQuoteOrderNo(s.quotes.all()),
      description: (body.Description as string) ?? "",
      customer_id: custId,
      site_id: siteId,
      stage: (body.Stage as "Pending" | "Approved" | "Rejected" | "Converted") ?? "Pending",
      status_id: null,
      issued_date: (body.DateIssued as string) ?? new Date().toISOString(),
      due_date: (body.DateDue as string) ?? "",
      total_ex_tax: (body.TotalExTax as number) ?? 0,
      total_inc_tax: (body.TotalIncTax as number) ?? 0,
      converted_job_id: null,
    });
    return c.json(formatQuote(quote, s), 201);
  });

  // Get quote
  app.get(`${C}/quotes/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const quote = s.quotes.get(id);
    if (!quote) return simproError(c, 404, "Quote not found");
    return c.json(formatQuote(quote, s));
  });

  // Update quote
  app.put(`${C}/quotes/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.quotes.get(id);
    if (!existing) return simproError(c, 404, "Quote not found");

    const body = await parseSimproBody(c);
    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;

    const updated = s.quotes.update(id, {
      order_no: (body.OrderNo as string) ?? existing.order_no,
      description: (body.Description as string) ?? existing.description,
      customer_id: customerRef?.ID ? parseInt(String(customerRef.ID), 10) : existing.customer_id,
      site_id: siteRef?.ID ? parseInt(String(siteRef.ID), 10) : existing.site_id,
      stage: (body.Stage as "Pending" | "Approved" | "Rejected" | "Converted") ?? existing.stage,
      issued_date: (body.DateIssued as string) ?? existing.issued_date,
      due_date: (body.DateDue as string) ?? existing.due_date,
      total_ex_tax: (body.TotalExTax as number) ?? existing.total_ex_tax,
      total_inc_tax: (body.TotalIncTax as number) ?? existing.total_inc_tax,
    });
    return c.json(formatQuote(updated!, s));
  });

  // Delete quote
  app.delete(`${C}/quotes/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().quotes.delete(id);
    if (!deleted) return simproError(c, 404, "Quote not found");
    return c.json({ ID: id });
  });

  // Convert quote to job
  app.post(`${C}/quotes/:id/convert/`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const quote = s.quotes.get(id);
    if (!quote) return simproError(c, 404, "Quote not found");
    if (quote.stage === "Converted") return simproError(c, 409, "Quote already converted");

    // Create the job from quote fields
    const job = s.jobs.insert({
      type: "Job",
      order_no: nextJobOrderNo(s.jobs.all()),
      description: quote.description,
      customer_id: quote.customer_id,
      site_id: quote.site_id,
      stage: "Pending",
      status_id: null,
      issued_date: quote.issued_date,
      due_date: quote.due_date,
      total_ex_tax: quote.total_ex_tax,
      total_inc_tax: quote.total_inc_tax,
      sections: [],
      tags: [],
    });

    // Mark quote as converted
    s.quotes.update(id, { stage: "Converted", converted_job_id: job.id });

    return c.json({ Job: { ID: job.id, OrderNo: job.order_no } });
  });
}
