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
import { formatLabourRate, formatStatus, formatStockItem, formatTaxCode } from "../formatters.js";

/**
 * Reference-data endpoints: tax codes, labour rates, statuses, stock items,
 * zones, custom fields. Read-only in the emulator — seeded via config or
 * the defaults helper.
 */
export function referenceRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled = store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  app.get("/api/v1.0/companies/:cid/setup/taxCodes/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.taxCodes.all().filter((t) => t.company_id === companyId || companyId === 0);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatTaxCode));
  });

  app.get("/api/v1.0/companies/:cid/setup/taxCodes/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const tc = ss.taxCodes.findOneBy("external_id", Number(c.req.param("id")));
    if (!tc) return simproNotFound(c);
    return c.json(formatTaxCode(tc));
  });

  app.get("/api/v1.0/companies/:cid/setup/labor/laborRates/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.labourRates.all().filter((r) => r.company_id === companyId || companyId === 0);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatLabourRate));
  });

  app.get("/api/v1.0/companies/:cid/setup/statuses/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const kind = c.req.query("kind");
    let items = ss.statuses.all().filter((s) => s.company_id === companyId || companyId === 0);
    if (kind) items = items.filter((s) => s.kind === kind);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatStatus));
  });

  app.get("/api/v1.0/companies/:cid/catalogs/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.stockItems.all().filter((s) => s.company_id === companyId || companyId === 0);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map(formatStockItem));
  });

  app.get("/api/v1.0/companies/:cid/setup/zones/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const items = ss.zones.all().filter((z) => z.company_id === companyId || companyId === 0);
    const page = paginate(c, items, parsePagination(c));
    return c.json(page.map((z) => ({ ID: z.external_id, Name: z.name })));
  });

  app.get("/api/v1.0/companies/:cid/setup/customFields/:entity/", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const companyId = Number(c.req.param("cid")) || 0;
    const entity = c.req.param("entity");
    const items = ss.customFields
      .all()
      .filter((f) => (f.company_id === companyId || companyId === 0) && f.entity === entity);
    return c.json(items.map((f) => ({ ID: f.external_id, Name: f.name, Type: f.field_type })));
  });

  app.get("/api/v1.0/companies/:cid/setup/labor/laborRates/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const lr = ss.labourRates.findOneBy("external_id", Number(c.req.param("id")));
    if (!lr) return simproNotFound(c);
    return c.json(formatLabourRate(lr));
  });

  app.get("/api/v1.0/companies/:cid/setup/statuses/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const st = ss.statuses.findOneBy("external_id", Number(c.req.param("id")));
    if (!st) return simproNotFound(c);
    return c.json(formatStatus(st));
  });

  app.get("/api/v1.0/companies/:cid/catalogs/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const item = ss.stockItems.findOneBy("external_id", Number(c.req.param("id")));
    if (!item) return simproNotFound(c);
    return c.json(formatStockItem(item));
  });

  app.get("/api/v1.0/companies/:cid/setup/zones/:id", (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const zone = ss.zones.findOneBy("external_id", Number(c.req.param("id")));
    if (!zone) return simproNotFound(c);
    return c.json({ ID: zone.external_id, Name: zone.name });
  });
}
