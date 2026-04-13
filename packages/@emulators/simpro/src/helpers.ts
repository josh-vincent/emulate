import type { Context } from "hono";
import type { SimproJob, SimproQuote, SimproInvoice } from "./entities.js";

// SimPRO error envelope: { "responseCode": N, "message": "..." }
export function simproError(c: Context, status: number, message: string) {
  return c.json({ responseCode: status, message }, status as 400 | 401 | 403 | 404 | 409 | 422 | 500);
}

// Pagination helper: reads ?pageSize (default 30, max 250) and ?page (default 1).
// Sets X-Record-Count header to total item count.
// Returns c.json(page slice mapped through formatFn).
export function simproPaginate<T>(
  c: Context,
  items: T[],
  formatFn: (item: T) => unknown,
) {
  const rawSize = parseInt(c.req.query("pageSize") ?? "30", 10);
  const pageSize = Math.min(isNaN(rawSize) || rawSize < 1 ? 30 : rawSize, 250);
  const rawPage = parseInt(c.req.query("page") ?? "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  c.header("X-Record-Count", String(items.length));
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return c.json(slice.map(formatFn));
}

// Convert an ISO UTC string to an AEST +11:00 representation.
// SimPRO always returns offset-aware ISO dates in AEST/AEDT.
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  // Parse the date and format with AEST offset (+11:00).
  // We use a fixed +11:00 offset for simplicity (AEDT summer time is standard for SimPRO API docs).
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const offsetMs = 11 * 60 * 60 * 1000;
  const local = new Date(d.getTime() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}+11:00`;
}

// Generate an order number in the format "PREFIX-YYYY-NNN".
// prefix: "J" | "Q" | "INV"
export function nextOrderNo(
  prefix: string,
  existing: Array<{ order_no?: string; invoice_no?: string }>,
): string {
  const year = new Date().getFullYear();
  const yearStr = String(year);
  let max = 0;
  for (const item of existing) {
    const no = (item as { order_no?: string; invoice_no?: string }).order_no
      ?? (item as { invoice_no?: string }).invoice_no
      ?? "";
    // e.g. "J-2025-007"
    const parts = no.split("-");
    if (parts.length >= 3 && parts[parts.length - 2] === yearStr) {
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > max) max = seq;
    }
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

// Get the next section id for a job (sections stored as JSON blob).
export function nextSectionId(job: SimproJob): number {
  if (!job.sections || job.sections.length === 0) return 1;
  return Math.max(...job.sections.map((s) => s.id)) + 1;
}

// Get the next cost center id within a section.
export function nextCostCenterId(sectionCostCenters: Array<{ id: number }>): number {
  if (!sectionCostCenters || sectionCostCenters.length === 0) return 1;
  return Math.max(...sectionCostCenters.map((cc) => cc.id)) + 1;
}

// Parse JSON body with fallback to empty object.
export async function parseSimproBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return (body as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

// Parse integer path parameter, returning undefined if invalid.
export function parseId(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return isNaN(n) ? undefined : n;
}

// Overload helpers for nextOrderNoForJobs / nextOrderNoForQuotes / nextOrderNoForInvoices
export function nextJobOrderNo(jobs: SimproJob[]): string {
  return nextOrderNo("J", jobs.map((j) => ({ order_no: j.order_no })));
}

export function nextQuoteOrderNo(quotes: SimproQuote[]): string {
  return nextOrderNo("Q", quotes.map((q) => ({ order_no: q.order_no })));
}

export function nextInvoiceNo(invoices: SimproInvoice[]): string {
  return nextOrderNo("INV", invoices.map((i) => ({ order_no: i.invoice_no })));
}
