import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatAsset } from "../formatters.js";
import type { CustomFieldValue } from "../entities.js";

const C = "/api/v1.0/companies/:c";

export function assetRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // Global asset list — filter: Customer.ID, Site.ID
  app.get(`${C}/assets/`, (c) => {
    const customerIdStr = c.req.query("Customer.ID");
    const siteIdStr = c.req.query("Site.ID");

    let assets = ss().assets.all();
    if (customerIdStr) {
      const custId = parseInt(customerIdStr, 10);
      if (!isNaN(custId)) assets = assets.filter((a) => a.customer_id === custId);
    }
    if (siteIdStr) {
      const siteId = parseInt(siteIdStr, 10);
      if (!isNaN(siteId)) assets = assets.filter((a) => a.site_id === siteId);
    }

    const s = ss();
    return simproPaginate(c, assets, (a) => formatAsset(a, s));
  });

  // List assets for customer — filter: Site.ID
  app.get(`${C}/customers/:custId/assets/`, (c) => {
    const custId = parseId(c.req.param("custId"));
    if (!custId) return simproError(c, 400, "Invalid customer ID");
    const s = ss();
    if (!s.customers.get(custId)) return simproError(c, 404, "Customer not found");

    const siteIdStr = c.req.query("Site.ID");
    let assets = s.assets.findBy("customer_id", custId);
    if (siteIdStr) {
      const siteId = parseInt(siteIdStr, 10);
      if (!isNaN(siteId)) assets = assets.filter((a) => a.site_id === siteId);
    }
    return simproPaginate(c, assets, (a) => formatAsset(a, s));
  });

  // Create asset
  app.post(`${C}/customers/:custId/assets/`, async (c) => {
    const custId = parseId(c.req.param("custId"));
    if (!custId) return simproError(c, 400, "Invalid customer ID");
    const s = ss();
    if (!s.customers.get(custId)) return simproError(c, 404, "Customer not found");

    const body = await parseSimproBody(c);
    const assetTypeRef = body.AssetType as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;
    const slRef = body.ServiceLevel as Record<string, unknown> | undefined;

    const asset = s.assets.insert({
      name: (body.Name as string) ?? "",
      asset_type_id: assetTypeRef?.ID ? parseInt(String(assetTypeRef.ID), 10) : null,
      asset_type_name: (assetTypeRef?.Name as string) ?? "",
      customer_id: custId,
      site_id: siteRef?.ID ? parseInt(String(siteRef.ID), 10) : null,
      serial_no: (body.SerialNo as string) ?? "",
      service_level_id: slRef?.ID ? parseInt(String(slRef.ID), 10) : null,
      service_level_name: (slRef?.Name as string) ?? "",
      next_service_date: (body.DateNextService as string) ?? "",
      status: (body.Status as string) ?? "Active",
      date_installed: (body.DateInstalled as string) ?? "",
      custom_fields: (body.CustomFields as CustomFieldValue[]) ?? [],
    });
    return c.json(formatAsset(asset, s), 201);
  });

  // Get asset
  app.get(`${C}/customers/:custId/assets/:id`, (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const asset = s.assets.get(id);
    if (!asset || asset.customer_id !== custId) return simproError(c, 404, "Asset not found");
    return c.json(formatAsset(asset, s));
  });

  // Update asset
  app.put(`${C}/customers/:custId/assets/:id`, async (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.assets.get(id);
    if (!existing || existing.customer_id !== custId) return simproError(c, 404, "Asset not found");

    const body = await parseSimproBody(c);
    const assetTypeRef = body.AssetType as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;
    const slRef = body.ServiceLevel as Record<string, unknown> | undefined;

    const updated = s.assets.update(id, {
      name: (body.Name as string) ?? existing.name,
      asset_type_id: assetTypeRef?.ID ? parseInt(String(assetTypeRef.ID), 10) : existing.asset_type_id,
      asset_type_name: (assetTypeRef?.Name as string) ?? existing.asset_type_name,
      site_id: siteRef?.ID ? parseInt(String(siteRef.ID), 10) : existing.site_id,
      serial_no: (body.SerialNo as string) ?? existing.serial_no,
      service_level_id: slRef?.ID ? parseInt(String(slRef.ID), 10) : existing.service_level_id,
      service_level_name: (slRef?.Name as string) ?? existing.service_level_name,
      next_service_date: (body.DateNextService as string) ?? existing.next_service_date,
      status: (body.Status as string) ?? existing.status,
      date_installed: (body.DateInstalled as string) ?? existing.date_installed,
      custom_fields: (body.CustomFields as CustomFieldValue[]) ?? existing.custom_fields,
    });
    return c.json(formatAsset(updated!, s));
  });

  // Delete asset
  app.delete(`${C}/customers/:custId/assets/:id`, (c) => {
    const custId = parseId(c.req.param("custId"));
    const id = parseId(c.req.param("id"));
    if (!custId || !id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.assets.get(id);
    if (!existing || existing.customer_id !== custId) return simproError(c, 404, "Asset not found");
    s.assets.delete(id);
    return c.json({ ID: id });
  });
}
