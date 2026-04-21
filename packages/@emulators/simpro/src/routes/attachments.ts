import type { Context } from "hono";
import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import type { SimproAttachmentParentType } from "../entities.js";
import {
  paginate,
  parsePagination,
  rateLimit,
  requireAuth,
  simproNotFound,
} from "../helpers.js";
import { formatAttachment } from "../formatters.js";

/**
 * Attachment endpoints for Simpro Build v1.0. Attachments are nested under
 * each parent entity — the real API exposes six parallel routes:
 *
 *   GET /api/v1.0/companies/:cid/jobs/:id/attachments/
 *   GET /api/v1.0/companies/:cid/quotes/:id/attachments/
 *   GET /api/v1.0/companies/:cid/invoices/:id/attachments/
 *   GET /api/v1.0/companies/:cid/customers/:id/attachments/
 *   GET /api/v1.0/companies/:cid/sites/:id/attachments/
 *   GET /api/v1.0/companies/:cid/assets/:id/attachments/
 *
 * Each returns the attachments for that specific parent, discovered via the
 * parent_type + parent_id keys on the attachment row.
 */
const PARENT_TYPES: ReadonlyArray<{
  segment: string;
  parentType: SimproAttachmentParentType;
}> = [
  { segment: "jobs", parentType: "job" },
  { segment: "quotes", parentType: "quote" },
  { segment: "invoices", parentType: "invoice" },
  { segment: "customers", parentType: "customer" },
  { segment: "sites", parentType: "site" },
  { segment: "assets", parentType: "asset" },
];

export function attachmentRoutes({ app, store }: RouteContext): void {
  const ss = getSimproStore(store);

  const guard = (c: Context): Response | null => {
    const rateEnabled =
      store.getData<boolean>("simpro.rate_limit_enabled") ?? false;
    const rl = rateLimit(c, rateEnabled);
    if (rl) return rl;
    const auth = requireAuth(c, ss);
    if (auth) return auth as unknown as Response;
    return null;
  };

  for (const { segment, parentType } of PARENT_TYPES) {
    app.get(
      `/api/v1.0/companies/:cid/${segment}/:id/attachments/`,
      (c) => {
        const blocked = guard(c);
        if (blocked) return blocked;
        const companyId = Number(c.req.param("cid")) || 0;
        const parentId = Number(c.req.param("id"));
        const items = ss.attachments
          .all()
          .filter(
            (a) =>
              (a.company_id === companyId || companyId === 0) &&
              a.parent_type === parentType &&
              a.parent_id === parentId,
          );
        const page = paginate(c, items, parsePagination(c));
        return c.json(page.map(formatAttachment));
      },
    );

    app.get(
      `/api/v1.0/companies/:cid/${segment}/:id/attachments/:attachmentId`,
      (c) => {
        const blocked = guard(c);
        if (blocked) return blocked;
        const parentId = Number(c.req.param("id"));
        const attachmentId = Number(c.req.param("attachmentId"));
        const attachment = ss.attachments
          .all()
          .find(
            (a) =>
              a.parent_type === parentType &&
              a.parent_id === parentId &&
              a.external_id === attachmentId,
          );
        if (!attachment) return simproNotFound(c);
        return c.json(formatAttachment(attachment));
      },
    );
  }
}
