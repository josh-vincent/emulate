import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatContractor } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function contractorRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List contractors
  app.get(`${C}/contractors/`, (c) => {
    const statusFilter = c.req.query("Status");
    let contractors = ss().contractors.all();
    if (statusFilter) contractors = contractors.filter((ct) => ct.status === statusFilter);
    return simproPaginate(c, contractors, formatContractor);
  });

  // Create contractor
  app.post(`${C}/contractors/`, async (c) => {
    const body = await parseSimproBody(c);
    const contractor = ss().contractors.insert({
      company_name: (body.CompanyName as string) ?? "",
      given_name: (body.GivenName as string) ?? "",
      family_name: (body.FamilyName as string) ?? "",
      email: (body.Email as string) ?? "",
      phone: (body.Phone as string) ?? "",
      status: (body.Status as "Active" | "Inactive") ?? "Active",
    });
    return c.json(formatContractor(contractor), 201);
  });

  // Get contractor
  app.get(`${C}/contractors/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const contractor = ss().contractors.get(id);
    if (!contractor) return simproError(c, 404, "Contractor not found");
    return c.json(formatContractor(contractor));
  });

  // Update contractor
  app.put(`${C}/contractors/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.contractors.get(id);
    if (!existing) return simproError(c, 404, "Contractor not found");

    const body = await parseSimproBody(c);
    const updated = s.contractors.update(id, {
      company_name: (body.CompanyName as string) ?? existing.company_name,
      given_name: (body.GivenName as string) ?? existing.given_name,
      family_name: (body.FamilyName as string) ?? existing.family_name,
      email: (body.Email as string) ?? existing.email,
      phone: (body.Phone as string) ?? existing.phone,
      status: (body.Status as "Active" | "Inactive") ?? existing.status,
    });
    return c.json(formatContractor(updated!));
  });
}
