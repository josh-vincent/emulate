import type { Context } from "hono";
import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  paginate,
  parsePagination,
  rateLimit,
  requireAuth,
  simproNotFound,
} from "../helpers.js";
import { formatInvoice } from "../formatters.js";

export function invoiceRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  // Top-level invoice listing
  app.get("/api/v1.0/companies/:cid/invoices/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.invoices.all().filter((i) => i.company_id === companyId || companyId === 0);

    const jobId = c.req.query("Job.ID");
    if (jobId) items = items.filter((i) => i.job_id === Number(jobId));

    const stage = c.req.query("Stage");
    if (stage) items = items.filter((i) => i.stage === Number(stage));

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatInvoice));
  });

  app.get("/api/v1.0/companies/:cid/invoices/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const inv = ss.invoices.findOneBy("external_id", Number(c.req.param("id")));
    if (!inv) return simproNotFound(c);
    return c.json(formatInvoice(inv));
  });

  // Per-job invoice listing
  app.get("/api/v1.0/companies/:cid/jobs/:jid/invoices/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    const jobId = Number(c.req.param("jid"));
    const items = ss.invoices.findBy("job_id", jobId);
    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatInvoice));
  });
}
