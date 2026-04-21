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
import { formatContact } from "../formatters.js";

/**
 * Contact endpoints for Simpro Build v1.0:
 *   GET /api/v1.0/companies/:cid/contacts/
 *   GET /api/v1.0/companies/:cid/contacts/:id
 *   GET /api/v1.0/companies/:cid/customers/:customerId/contacts/
 *   GET /api/v1.0/companies/:cid/sites/:siteId/contacts/
 */
export function contactRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/contacts/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.contacts
      .all()
      .filter((x) => x.company_id === companyId || companyId === 0);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatContact));
  });

  app.get("/api/v1.0/companies/:cid/contacts/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const contact = ss.contacts.findOneBy("external_id", Number(c.req.param("id")));
    if (!contact) return simproNotFound(c);
    return c.json(formatContact(contact));
  });

  app.get("/api/v1.0/companies/:cid/customers/:customerId/contacts/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const customerId = Number(c.req.param("customerId"));
    const items = ss.contacts
      .findBy("customer_id", customerId)
      .filter((x) => x.type === "Customer");
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatContact));
  });

  app.get("/api/v1.0/companies/:cid/sites/:siteId/contacts/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const siteId = Number(c.req.param("siteId"));
    const items = ss.contacts.findBy("site_id", siteId);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatContact));
  });
}
