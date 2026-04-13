import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
  nextInvoiceNo,
} from "../helpers.js";
import { formatInvoice } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function invoiceRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List invoices — filter: Customer.ID, Job.ID, Status
  app.get(`${C}/customerInvoices/`, (c) => {
    const customerIdStr = c.req.query("Customer.ID");
    const jobIdStr = c.req.query("Job.ID");
    const statusFilter = c.req.query("Status");

    let invoices = ss().invoices.all();
    if (customerIdStr) {
      const custId = parseInt(customerIdStr, 10);
      if (!isNaN(custId)) invoices = invoices.filter((inv) => inv.customer_id === custId);
    }
    if (jobIdStr) {
      const jobId = parseInt(jobIdStr, 10);
      if (!isNaN(jobId)) invoices = invoices.filter((inv) => inv.job_id === jobId);
    }
    if (statusFilter) invoices = invoices.filter((inv) => inv.status === statusFilter);

    const s = ss();
    return simproPaginate(c, invoices, (inv) => formatInvoice(inv, s));
  });

  // Create invoice
  app.post(`${C}/customerInvoices/`, async (c) => {
    const body = await parseSimproBody(c);
    const s = ss();

    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const jobRef = body.Job as Record<string, unknown> | undefined;

    const custId = customerRef?.ID ? parseInt(String(customerRef.ID), 10) : 0;
    const jobId = jobRef?.ID ? parseInt(String(jobRef.ID), 10) : null;

    const totalExTax = (body.TotalExTax as number) ?? 0;
    const totalIncTax = (body.TotalIncTax as number) ?? totalExTax;
    const amountPaid = (body.AmountPaid as number) ?? 0;

    const invoice = s.invoices.insert({
      invoice_no: (body.InvoiceNo as string) || nextInvoiceNo(s.invoices.all()),
      customer_id: custId,
      job_id: jobId,
      status: (body.Status as "Draft" | "Issued" | "Paid" | "Void") ?? "Draft",
      total_ex_tax: totalExTax,
      total_inc_tax: totalIncTax,
      amount_paid: amountPaid,
      balance: totalIncTax - amountPaid,
      issued_date: (body.DateIssued as string) ?? new Date().toISOString(),
      due_date: (body.DateDue as string) ?? "",
    });
    return c.json(formatInvoice(invoice, s), 201);
  });

  // Get invoice
  app.get(`${C}/customerInvoices/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const invoice = s.invoices.get(id);
    if (!invoice) return simproError(c, 404, "Invoice not found");
    return c.json(formatInvoice(invoice, s));
  });

  // Update invoice
  app.put(`${C}/customerInvoices/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.invoices.get(id);
    if (!existing) return simproError(c, 404, "Invoice not found");

    const body = await parseSimproBody(c);
    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const jobRef = body.Job as Record<string, unknown> | undefined;

    const totalIncTax = (body.TotalIncTax as number) ?? existing.total_inc_tax;
    const amountPaid = (body.AmountPaid as number) ?? existing.amount_paid;

    const updated = s.invoices.update(id, {
      invoice_no: (body.InvoiceNo as string) ?? existing.invoice_no,
      customer_id: customerRef?.ID ? parseInt(String(customerRef.ID), 10) : existing.customer_id,
      job_id: jobRef?.ID ? parseInt(String(jobRef.ID), 10) : existing.job_id,
      status: (body.Status as "Draft" | "Issued" | "Paid" | "Void") ?? existing.status,
      total_ex_tax: (body.TotalExTax as number) ?? existing.total_ex_tax,
      total_inc_tax: totalIncTax,
      amount_paid: amountPaid,
      balance: totalIncTax - amountPaid,
      issued_date: (body.DateIssued as string) ?? existing.issued_date,
      due_date: (body.DateDue as string) ?? existing.due_date,
    });
    return c.json(formatInvoice(updated!, s));
  });

  // Delete invoice
  app.delete(`${C}/customerInvoices/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().invoices.delete(id);
    if (!deleted) return simproError(c, 404, "Invoice not found");
    return c.json({ ID: id });
  });
}
