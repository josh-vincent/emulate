import type { RouteContext } from "@emulators/core";
import { formatDefect } from "../formatters.js";
import { parseId, parseJsonApiBody, relId, uptickError, uptickPaginate } from "../helpers.js";
import { getUptickStore } from "../store.js";

export function defectRoutes({ app, store }: RouteContext): void {
  const us = () => getUptickStore(store);

  app.get("/api/:ver/defects/", (c) => {
    const s = us();
    let defects = s.defects.all();

    const assetFilter = c.req.query("asset");
    if (assetFilter) {
      const aid = parseInt(assetFilter, 10);
      if (!isNaN(aid)) defects = defects.filter((d) => d.asset_id === aid);
    }

    const propertyFilter = c.req.query("property");
    if (propertyFilter) {
      const pid = parseInt(propertyFilter, 10);
      if (!isNaN(pid)) defects = defects.filter((d) => d.property_id === pid);
    }

    const clientFilter = c.req.query("client");
    if (clientFilter) {
      const cid = parseInt(clientFilter, 10);
      if (!isNaN(cid)) defects = defects.filter((d) => d.client_id === cid);
    }

    const statusFilter = c.req.query("status");
    if (statusFilter) {
      defects = defects.filter((d) => d.status === statusFilter);
    }

    return uptickPaginate(
      c,
      defects,
      (d) => formatDefect(d, s),
      `/api/${c.req.param("ver")}/defects/`,
    );
  });

  app.post("/api/:ver/defects/", async (c) => {
    const s = us();
    const { attributes, relationships } = await parseJsonApiBody(c);
    const assetId = relId((relationships.asset as Record<string, unknown>));
    const propertyId = relId((relationships.property as Record<string, unknown>));
    const clientId = relId((relationships.client as Record<string, unknown>));

    // Auto-resolve property and client from asset if not provided
    let resolvedPropertyId = propertyId;
    let resolvedClientId = clientId;
    if (assetId && !resolvedPropertyId) {
      const asset = s.assets.get(assetId);
      if (asset) {
        resolvedPropertyId = asset.property_id ?? null;
        resolvedClientId = resolvedClientId ?? asset.client_id ?? null;
      }
    }

    const defect = s.defects.insert({
      description: (attributes.description as string) ?? "",
      notes: (attributes.notes as string) ?? "",
      severity: (attributes.severity as string) ?? "",
      status: (attributes.status as string) ?? "open",
      asset_id: assetId ?? null,
      property_id: resolvedPropertyId ?? null,
      client_id: resolvedClientId ?? null,
    });
    return c.json({ data: formatDefect(defect, s) }, 201);
  });

  app.get("/api/:ver/defects/:id", (c) => {
    const s = us();
    const id = parseId(c.req.param("id"));
    if (!id) return uptickError(c, 400, "Invalid ID");
    const defect = s.defects.get(id);
    if (!defect) return uptickError(c, 404, "Not Found");
    return c.json({ data: formatDefect(defect, s) });
  });

  app.patch("/api/:ver/defects/:id", async (c) => {
    const s = us();
    const id = parseId(c.req.param("id"));
    if (!id) return uptickError(c, 400, "Invalid ID");
    const existing = s.defects.get(id);
    if (!existing) return uptickError(c, 404, "Not Found");

    const { attributes, relationships } = await parseJsonApiBody(c);
    const assetId = relId((relationships.asset as Record<string, unknown>));
    const propertyId = relId((relationships.property as Record<string, unknown>));
    const clientId = relId((relationships.client as Record<string, unknown>));

    const updated = s.defects.update(id, {
      description: (attributes.description as string) ?? existing.description,
      notes: (attributes.notes as string) ?? existing.notes,
      severity: (attributes.severity as string) ?? existing.severity,
      status: (attributes.status as string) ?? existing.status,
      asset_id: assetId ?? existing.asset_id,
      property_id: propertyId ?? existing.property_id,
      client_id: clientId ?? existing.client_id,
    });
    return c.json({ data: formatDefect(updated!, s) });
  });
}
