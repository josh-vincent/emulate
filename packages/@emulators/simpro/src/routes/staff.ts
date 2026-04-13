import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatStaff } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function staffRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List staff — filter: Status
  app.get(`${C}/staff/`, (c) => {
    const statusFilter = c.req.query("Status");
    let staff = ss().staff.all();
    if (statusFilter) staff = staff.filter((s) => s.status === statusFilter);
    return simproPaginate(c, staff, formatStaff);
  });

  // Create staff
  app.post(`${C}/staff/`, async (c) => {
    const body = await parseSimproBody(c);
    const member = ss().staff.insert({
      given_name: (body.GivenName as string) ?? "",
      family_name: (body.FamilyName as string) ?? "",
      email: (body.Email as string) ?? "",
      phone: (body.Phone as string) ?? "",
      mobile: (body.Mobile as string) ?? "",
      role_id: ((body.Role as Record<string, number>)?.ID) ?? null,
      role_name: ((body.Role as Record<string, string>)?.Name) ?? "",
      status: (body.Status as "Active" | "Inactive") ?? "Active",
    });
    return c.json(formatStaff(member), 201);
  });

  // Get staff member
  app.get(`${C}/staff/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const member = ss().staff.get(id);
    if (!member) return simproError(c, 404, "Staff member not found");
    return c.json(formatStaff(member));
  });

  // Update staff member
  app.put(`${C}/staff/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.staff.get(id);
    if (!existing) return simproError(c, 404, "Staff member not found");

    const body = await parseSimproBody(c);
    const updated = s.staff.update(id, {
      given_name: (body.GivenName as string) ?? existing.given_name,
      family_name: (body.FamilyName as string) ?? existing.family_name,
      email: (body.Email as string) ?? existing.email,
      phone: (body.Phone as string) ?? existing.phone,
      mobile: (body.Mobile as string) ?? existing.mobile,
      role_id: ((body.Role as Record<string, number>)?.ID) ?? existing.role_id,
      role_name: ((body.Role as Record<string, string>)?.Name) ?? existing.role_name,
      status: (body.Status as "Active" | "Inactive") ?? existing.status,
    });
    return c.json(formatStaff(updated!));
  });
}
