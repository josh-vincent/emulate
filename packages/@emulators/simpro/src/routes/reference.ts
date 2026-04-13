import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import {
  formatCostCenter,
  formatLaborRate,
  formatTaxCode,
  formatCatalogItem,
  formatStatus,
  formatZone,
  formatCustomField,
  formatWebhook,
} from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function referenceRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // ---- Cost Centers ----
  app.get(`${C}/costCenters/`, (c) => {
    return simproPaginate(c, ss().costCenters.all(), formatCostCenter);
  });

  app.get(`${C}/costCenters/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const cc = ss().costCenters.get(id);
    if (!cc) return simproError(c, 404, "Cost center not found");
    return c.json(formatCostCenter(cc));
  });

  // ---- Labor Rates ----
  app.get(`${C}/laborRates/`, (c) => {
    return simproPaginate(c, ss().laborRates.all(), formatLaborRate);
  });

  app.get(`${C}/laborRates/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const lr = ss().laborRates.get(id);
    if (!lr) return simproError(c, 404, "Labor rate not found");
    return c.json(formatLaborRate(lr));
  });

  // ---- Tax Codes ----
  app.get(`${C}/tax/`, (c) => {
    return simproPaginate(c, ss().taxCodes.all(), formatTaxCode);
  });

  app.get(`${C}/tax/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const tc = ss().taxCodes.get(id);
    if (!tc) return simproError(c, 404, "Tax code not found");
    return c.json(formatTaxCode(tc));
  });

  // ---- Catalog Items ----
  app.get(`${C}/catalog/items/`, (c) => {
    const q = c.req.query("q")?.toLowerCase();
    let items = ss().catalogItems.all();
    if (q) items = items.filter((i) => i.name.toLowerCase().includes(q));
    return simproPaginate(c, items, formatCatalogItem);
  });

  app.get(`${C}/catalog/items/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const ci = ss().catalogItems.get(id);
    if (!ci) return simproError(c, 404, "Catalog item not found");
    return c.json(formatCatalogItem(ci));
  });

  // ---- Statuses ----
  app.get(`${C}/statuses/jobs/`, (c) => {
    const statuses = ss().statuses.findBy("entity_type", "job");
    return simproPaginate(c, statuses, formatStatus);
  });

  app.get(`${C}/statuses/quotes/`, (c) => {
    const statuses = ss().statuses.findBy("entity_type", "quote");
    return simproPaginate(c, statuses, formatStatus);
  });

  // ---- Zones ----
  app.get(`${C}/zones/`, (c) => {
    return simproPaginate(c, ss().zones.all(), formatZone);
  });

  // ---- Custom Fields ----
  app.get(`${C}/customFields/`, (c) => {
    return simproPaginate(c, ss().customFields.all(), formatCustomField);
  });

  // ---- Webhooks ----
  app.get(`${C}/webhooks/`, (c) => {
    return simproPaginate(c, ss().webhooks.all(), formatWebhook);
  });

  app.post(`${C}/webhooks/`, async (c) => {
    const body = await parseSimproBody(c);
    const webhook = ss().webhooks.insert({
      url: (body.URL as string) ?? "",
      events: (body.Events as string[]) ?? [],
      active: (body.Active as boolean) ?? true,
      secret: (body.Secret as string) ?? "",
    });
    return c.json(formatWebhook(webhook), 201);
  });

  app.delete(`${C}/webhooks/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().webhooks.delete(id);
    if (!deleted) return simproError(c, 404, "Webhook not found");
    return c.json({ ID: id });
  });
}
