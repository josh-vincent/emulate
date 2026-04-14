import type { AppEnv } from "@emulators/core";
import type { Hono } from "hono";
import type { WorkOSStoreFacade } from "../store.js";

export function userRoutes(app: Hono<AppEnv>, ws: WorkOSStoreFacade): void {
  // Nested route: GET /user_management/users/:userId/organization_memberships
  app.get("/user_management/users/:userId/organization_memberships", (c) => {
    const userId = c.req.param("userId");
    const statusFilter = c.req.query("statuses[]") ?? "active";

    const memberships = ws.getUserMemberships(userId);
    const filtered =
      statusFilter === "active" ? memberships.filter((m) => m.status === "active") : memberships;

    const data = filtered.map((m) => ({
      ...m,
      organizationId: m.organization_id,
      organizationName: ws.getOrg(m.organization_id)?.name ?? m.organization_id,
    }));

    return c.json({ data, list_metadata: { after: null, before: null } });
  });

  // Flat list route (WorkOS SDK v8+): GET /user_management/organization_memberships?user_id=...
  app.get("/user_management/organization_memberships", (c) => {
    const userId = c.req.query("user_id");
    const statusFilter = c.req.query("statuses[]") ?? "active";

    const memberships = userId ? ws.getUserMemberships(userId) : [];
    const filtered =
      statusFilter === "active" ? memberships.filter((m) => m.status === "active") : memberships;

    const data = filtered.map((m) => ({
      ...m,
      organizationId: m.organization_id,
      organizationName: ws.getOrg(m.organization_id)?.name ?? m.organization_id,
    }));

    return c.json({ data, list_metadata: { after: null, before: null } });
  });
}
