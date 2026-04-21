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
import { formatAsset } from "../formatters.js";

export function assetRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/assets/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;

    const companyId = Number(c.req.param("cid")) || 0;
    let items = ss.assets.all().filter((a) => a.company_id === companyId || companyId === 0);

    const customerId = c.req.query("Customer.ID");
    if (customerId) items = items.filter((a) => a.customer_id === Number(customerId));

    const siteId = c.req.query("Site.ID");
    if (siteId) items = items.filter((a) => a.site_id === Number(siteId));

    const pagination = parsePagination(c);
    const page = paginate(c, items, pagination);
    return c.json(page.map((a) => formatAsset(a, ss)));
  });

  app.get("/api/v1.0/companies/:cid/assets/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const a = ss.assets.findOneBy("external_id", Number(c.req.param("id")));
    if (!a) return simproNotFound(c);
    return c.json(formatAsset(a, ss));
  });
}
