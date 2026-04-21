import type { Context } from "hono";
import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import type { SimproTimesheet } from "../entities.js";
import {
  paginate,
  parsePagination,
  rateLimit,
  requireAuth,
  simproNotFound,
} from "../helpers.js";

function formatTimesheet(t: SimproTimesheet) {
  return {
    ID: t.external_id,
    Employee: t.employee_id ? { ID: t.employee_id } : null,
    Contractor: t.contractor_id ? { ID: t.contractor_id } : null,
    Job: t.job_id ? { ID: t.job_id } : null,
    CostCenter: t.cost_center_id ? { ID: t.cost_center_id } : null,
    Date: t.date,
    StartTime: t.start_time,
    EndTime: t.end_time,
    DurationMinutes: t.duration_minutes,
    Notes: t.notes,
  };
}

export function timesheetRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  // ── Top-level timesheets list ─────────────────────────────────────────────

  app.get("/api/v1.0/companies/:cid/timesheets/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.timesheets.all().filter((t) => t.company_id === companyId || companyId === 0);

    const employeeId = c.req.query("Employee.ID");
    if (employeeId) items = items.filter((t) => t.employee_id === Number(employeeId));

    const jobId = c.req.query("Job.ID");
    if (jobId) items = items.filter((t) => t.job_id === Number(jobId));

    const dateFrom = c.req.query("DateFrom");
    if (dateFrom) items = items.filter((t) => t.date >= dateFrom);

    const dateTo = c.req.query("DateTo");
    if (dateTo) items = items.filter((t) => t.date <= dateTo);

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatTimesheet));
  });

  // ── Employee timesheets ───────────────────────────────────────────────────

  app.get("/api/v1.0/companies/:cid/employees/:eid/timesheets/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const employeeId = Number(c.req.param("eid"));
    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.timesheets
      .all()
      .filter(
        (t) => t.employee_id === employeeId && (t.company_id === companyId || companyId === 0),
      );

    const dateFrom = c.req.query("DateFrom");
    if (dateFrom) items = items.filter((t) => t.date >= dateFrom);

    const dateTo = c.req.query("DateTo");
    if (dateTo) items = items.filter((t) => t.date <= dateTo);

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatTimesheet));
  });

  // ── Contractor timesheets ─────────────────────────────────────────────────

  app.get("/api/v1.0/companies/:cid/contractors/:crid/timesheets/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const contractorId = Number(c.req.param("crid"));
    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.timesheets
      .all()
      .filter(
        (t) => t.contractor_id === contractorId && (t.company_id === companyId || companyId === 0),
      );

    const dateFrom = c.req.query("DateFrom");
    if (dateFrom) items = items.filter((t) => t.date >= dateFrom);

    const dateTo = c.req.query("DateTo");
    if (dateTo) items = items.filter((t) => t.date <= dateTo);

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatTimesheet));
  });

  // ── Single timesheet ──────────────────────────────────────────────────────

  app.get("/api/v1.0/companies/:cid/timesheets/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const t = ss.timesheets.findOneBy("external_id", Number(c.req.param("id")));
    if (!t) return simproNotFound(c);
    return c.json(formatTimesheet(t));
  });
}
