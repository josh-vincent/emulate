import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatCustomer } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function customerRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List customers — filter: Type, Status, q=name/company
  app.get(`${C}/customers/`, (c) => {
    const typeFilter = c.req.query("Type");
    const statusFilter = c.req.query("Status");
    const q = c.req.query("q")?.toLowerCase();

    let customers = ss().customers.all();
    if (typeFilter) customers = customers.filter((cu) => cu.type === typeFilter);
    if (statusFilter) customers = customers.filter((cu) => cu.status === statusFilter);
    if (q) {
      customers = customers.filter(
        (cu) =>
          cu.company_name.toLowerCase().includes(q) ||
          cu.given_name.toLowerCase().includes(q) ||
          cu.family_name.toLowerCase().includes(q) ||
          cu.email.toLowerCase().includes(q),
      );
    }
    return simproPaginate(c, customers, formatCustomer);
  });

  // Create customer
  app.post(`${C}/customers/`, async (c) => {
    const body = await parseSimproBody(c);
    const customer = ss().customers.insert({
      type: (body.Type as "Company" | "Individual") ?? "Company",
      company_name: (body.CompanyName as string) ?? "",
      given_name: (body.GivenName as string) ?? "",
      family_name: (body.FamilyName as string) ?? "",
      phone1: (body.Phone1 as string) ?? "",
      phone2: (body.Phone2 as string) ?? "",
      mobile: (body.Mobile as string) ?? "",
      fax: (body.Fax as string) ?? "",
      email: (body.Email as string) ?? "",
      tax_number: (body.TaxNumber as string) ?? "",
      mail_address: ((body.MailAddress as Record<string, string>)?.Address) ?? "",
      mail_suburb: ((body.MailAddress as Record<string, string>)?.Suburb) ?? "",
      mail_state: ((body.MailAddress as Record<string, string>)?.State) ?? "",
      mail_postcode: ((body.MailAddress as Record<string, string>)?.Postcode) ?? "",
      mail_country: ((body.MailAddress as Record<string, string>)?.Country) ?? "Australia",
      payment_term: (body.PaymentTerm as number) ?? 30,
      payment_term_type: (body.PaymentTermType as string) ?? "Day",
      status: (body.Status as "Active" | "Inactive") ?? "Active",
      custom_fields: (body.CustomFields as []) ?? [],
    });
    return c.json(formatCustomer(customer), 201);
  });

  // Get customer
  app.get(`${C}/customers/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const customer = ss().customers.get(id);
    if (!customer) return simproError(c, 404, "Customer not found");
    return c.json(formatCustomer(customer));
  });

  // Update customer
  app.put(`${C}/customers/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.customers.get(id);
    if (!existing) return simproError(c, 404, "Customer not found");

    const body = await parseSimproBody(c);
    const mailAddress = (body.MailAddress as Record<string, string>) ?? {};

    const updated = s.customers.update(id, {
      type: (body.Type as "Company" | "Individual") ?? existing.type,
      company_name: (body.CompanyName as string) ?? existing.company_name,
      given_name: (body.GivenName as string) ?? existing.given_name,
      family_name: (body.FamilyName as string) ?? existing.family_name,
      phone1: (body.Phone1 as string) ?? existing.phone1,
      phone2: (body.Phone2 as string) ?? existing.phone2,
      mobile: (body.Mobile as string) ?? existing.mobile,
      fax: (body.Fax as string) ?? existing.fax,
      email: (body.Email as string) ?? existing.email,
      tax_number: (body.TaxNumber as string) ?? existing.tax_number,
      mail_address: mailAddress.Address ?? existing.mail_address,
      mail_suburb: mailAddress.Suburb ?? existing.mail_suburb,
      mail_state: mailAddress.State ?? existing.mail_state,
      mail_postcode: mailAddress.Postcode ?? existing.mail_postcode,
      mail_country: mailAddress.Country ?? existing.mail_country,
      payment_term: (body.PaymentTerm as number) ?? existing.payment_term,
      payment_term_type: (body.PaymentTermType as string) ?? existing.payment_term_type,
      status: (body.Status as "Active" | "Inactive") ?? existing.status,
      custom_fields: (body.CustomFields as []) ?? existing.custom_fields,
    });
    return c.json(formatCustomer(updated!));
  });

  // Delete customer
  app.delete(`${C}/customers/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().customers.delete(id);
    if (!deleted) return simproError(c, 404, "Customer not found");
    return c.json({ ID: id });
  });
}
