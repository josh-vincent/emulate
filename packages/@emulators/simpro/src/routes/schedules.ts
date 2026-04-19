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
import { formatSchedule } from "../formatters.js";

export function scheduleRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/schedules/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.schedules.all().filter((s) => s.company_id === companyId || companyId === 0);

    const jobId = c.req.query("Job.ID");
    if (jobId) items = items.filter((s) => s.job_id === Number(jobId));

    const technicianId = c.req.query("Technician.ID");
    if (technicianId) items = items.filter((s) => s.technician_id === Number(technicianId));

    const dateFrom = c.req.query("DateFrom");
    if (dateFrom) items = items.filter((s) => s.date >= dateFrom);
    const dateTo = c.req.query("DateTo");
    if (dateTo) items = items.filter((s) => s.date <= dateTo);

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatSchedule));
  });

  app.get("/api/v1.0/companies/:cid/schedules/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const s = ss.schedules.findOneBy("external_id", Number(c.req.param("id")));
    if (!s) return simproNotFound(c);
    return c.json(formatSchedule(s));
  });
}
