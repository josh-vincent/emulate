import type { AppEnv } from "@emulators/core";
import type { Hono } from "hono";
import type { WorkOSStoreFacade } from "../store.js";

export function sessionRoutes(app: Hono<AppEnv>, ws: WorkOSStoreFacade): void {
  app.delete("/user_management/sessions/:sessionId", (c) => {
    ws.revokeSession(c.req.param("sessionId"));
    return c.body(null, 204);
  });
}
