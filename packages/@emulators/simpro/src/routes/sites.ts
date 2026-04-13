import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatSite } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function siteRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List all sites (top-level, for sync operations)
  app.get(`${C}/sites/`, (c) => {
    const s = ss();
    const sites = s.sites.all();
    return simproPaginate(c, sites, (site) => formatSite(site, s));
  });

  // List sites for customer
  app.get(`${C}/customers/:custId/sites/`, (c) => {
    const custId = parseId(c.req.param("custId"));
    if (!custId) return simproError(c, 400, "Invalid customer ID");
    const s = ss();
    if (!s.customers.get(custId)) return simproError(c, 404, "Customer not found");
    const sites = s.sites.findBy("customer_id", custId);
    return simproPaginate(c, sites, (site) => formatSite(site, s));
  });

  // Create site
  app.post(`${C}/customers/:custId/sites/`, async (c) => {
    const custId = parseId(c.req.param("custId"));
    if (!custId) return simproError(c, 400, "Invalid customer ID");
    const s = ss();
    if (!s.customers.get(custId)) return simproError(c, 404, "Customer not found");

    const body = await parseSimproBody(c);
    const addr = (body.Address as Record<string, string>) ?? {};

    const site = s.sites.insert({
      customer_id: custId,
      name: (body.Name as string) ?? "",
      address: addr.Address ?? "",
      suburb: addr.Suburb ?? "",
      state: addr.State ?? "",
      postcode: addr.Postcode ?? "",
      country: addr.Country ?? "Australia",
      contact_name: ((body.Contact as Record<string, string>)?.Name) ?? "",
      contact_phone: ((body.Contact as Record<string, string>)?.Phone) ?? "",
      contact_email: ((body.Contact as Record<string, string>)?.Email) ?? "",
    });
    return c.json(formatSite(site, s), 201);
  });

  // Get site
  app.get(`${C}/customers/:custId/sites/:id`, (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const site = s.sites.get(id);
    if (!site || site.customer_id !== custId) return simproError(c, 404, "Site not found");
    return c.json(formatSite(site, s));
  });

  // Update site
  app.put(`${C}/customers/:custId/sites/:id`, async (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.sites.get(id);
    if (!existing || existing.customer_id !== custId) return simproError(c, 404, "Site not found");

    const body = await parseSimproBody(c);
    const addr = (body.Address as Record<string, string>) ?? {};
    const contact = (body.Contact as Record<string, string>) ?? {};

    const updated = s.sites.update(id, {
      name: (body.Name as string) ?? existing.name,
      address: addr.Address ?? existing.address,
      suburb: addr.Suburb ?? existing.suburb,
      state: addr.State ?? existing.state,
      postcode: addr.Postcode ?? existing.postcode,
      country: addr.Country ?? existing.country,
      contact_name: contact.Name ?? existing.contact_name,
      contact_phone: contact.Phone ?? existing.contact_phone,
      contact_email: contact.Email ?? existing.contact_email,
    });
    return c.json(formatSite(updated!, s));
  });

  // Delete site
  app.delete(`${C}/customers/:custId/sites/:id`, (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.sites.get(id);
    if (!existing || existing.customer_id !== custId) return simproError(c, 404, "Site not found");
    s.sites.delete(id);
    return c.json({ ID: id });
  });
}
