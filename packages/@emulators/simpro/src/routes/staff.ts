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
import { formatContractor, formatStaff } from "../formatters.js";

export function staffRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/staff/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.staff.all().filter((s) => s.company_id === companyId || companyId === 0);
    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatStaff));
  });

  app.get("/api/v1.0/companies/:cid/staff/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const staff = ss.staff.findOneBy("external_id", Number(c.req.param("id")));
    if (!staff) return simproNotFound(c);
    return c.json(formatStaff(staff));
  });

  app.get("/api/v1.0/companies/:cid/contractors/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.contractors.all().filter((x) => x.company_id === companyId || companyId === 0);
    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map(formatContractor));
  });

  app.get("/api/v1.0/companies/:cid/contractors/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const contractor = ss.contractors.findOneBy("external_id", Number(c.req.param("id")));
    if (!contractor) return simproNotFound(c);
    return c.json(formatContractor(contractor));
  });
}
