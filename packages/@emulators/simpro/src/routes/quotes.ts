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
import { formatQuote } from "../formatters.js";
import { nextExternalId } from "./jobs.js";

export function quoteRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/quotes/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.quotes.all().filter((q) => q.company_id === companyId || companyId === 0);

    const customerId = c.req.query("Customer.ID");
    if (customerId) items = items.filter((q) => q.customer_id === Number(customerId));

    const stage = c.req.query("Stage");
    if (stage) items = items.filter((q) => q.stage === stage);

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatQuote));
  });

  app.get("/api/v1.0/companies/:cid/quotes/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const q = ss.quotes.findOneBy("external_id", Number(c.req.param("id")));
    if (!q) return simproNotFound(c);
    return c.json(formatQuote(q));
  });

  app.post("/api/v1.0/companies/:cid/quotes/", async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    let body: Record<string, unknown>;
    try {
      body = await parseJson(c);
    } catch {
      return simproError(c, 400, "Problems parsing JSON.");
    }

    const customerRef = body.Customer as { ID?: number } | undefined;
    if (!customerRef?.ID) return simproValidation(c, "Customer.ID", "Customer is required.");

    const companyId = Number(c.req.param("cid")) || 0;
    const externalId = nextExternalId(ss, "quotes", companyId);

    const q = ss.quotes.insert({
      company_id: companyId,
      external_id: externalId,
      name: (body.Name as string) ?? `Quote ${externalId}`,
      customer_id: customerRef.ID,
      site_id: ((body.Site as { ID?: number } | undefined)?.ID) ?? null,
      stage: "Open",
      total_ex_tax: 0,
      total_inc_tax: 0,
      date_issued: (body.DateIssued as string) ?? nowIso().slice(0, 10),
      converted_job_id: null,
    });
    return c.json(formatQuote(q), 201);
  });
}
