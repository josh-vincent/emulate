import type { RouteContext } from "@emulators/core";
import { formatAssetType, formatUser } from "../formatters.js";
import { parseId, uptickError, uptickPaginate } from "../helpers.js";
import { getUptickStore } from "../store.js";

export function referenceRoutes({ app, store }: RouteContext): void {
  const us = () => getUptickStore(store);

  // Asset types
  app.get("/api/:ver/assettypes/", (c) => {
    return uptickPaginate(
      c,
      us().assetTypes.all(),
      formatAssetType,
      `/api/${c.req.param("ver")}/assettypes/`,
    );
  });

  app.get("/api/:ver/assettypes/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return uptickError(c, 400, "Invalid ID");
    const at = us().assetTypes.get(id);
    if (!at) return uptickError(c, 404, "Not Found");
    return c.json({ data: formatAssetType(at) });
  });

  // Users
  app.get("/api/:ver/users/", (c) => {
    return uptickPaginate(
      c,
      us().users.all(),
      formatUser,
      `/api/${c.req.param("ver")}/users/`,
    );
  });

  app.get("/api/:ver/users/:id", (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return uptickError(c, 400, "Invalid ID");
    const user = us().users.get(id);
    if (!user) return uptickError(c, 404, "Not Found");
    return c.json({ data: formatUser(user) });
  });

  // API version info
  app.get("/api/version/", (c) => {
    return c.json({
      latest: "v2.15",
      deprecated: [],
      imminent_removal: [],
      removed: [],
    });
  });

  // Self-describing endpoint index (for any version)
  app.get("/api/:ver/", (c) => {
    const ver = c.req.param("ver");
    const base = `/api/${ver}`;
    return c.json({
      clients: `${base}/clients/`,
      properties: `${base}/properties/`,
      assets: `${base}/assets/`,
      defects: `${base}/defects/`,
      assettypes: `${base}/assettypes/`,
      users: `${base}/users/`,
    });
  });
}
