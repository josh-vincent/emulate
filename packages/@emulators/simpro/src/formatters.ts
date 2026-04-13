import { formatDate } from "./helpers.js";
import type { SimproStore } from "./store.js";
import type {
  SimproCustomer,
  SimproSite,
  SimproJob,
  JobSection,
  JobCostCenter,
  SimproQuote,
  SimproInvoice,
  SimproStaff,
  SimproContractor,
  SimproSchedule,
  SimproAsset,
  SimproCostCenter,
  SimproLaborRate,
  SimproTaxCode,
  SimproCatalogItem,
  SimproStatus,
  SimproZone,
  SimproCustomField,
  SimproWebhook,
} from "./entities.js";

export function formatCustomer(c: SimproCustomer): object {
  return {
    ID: c.id,
    Type: c.type,
    CompanyName: c.company_name,
    GivenName: c.given_name,
    FamilyName: c.family_name,
    Phone1: c.phone1,
    Phone2: c.phone2,
    Mobile: c.mobile,
    Fax: c.fax,
    Email: c.email,
    TaxNumber: c.tax_number,
    MailAddress: {
      Address: c.mail_address,
      Suburb: c.mail_suburb,
      State: c.mail_state,
      Postcode: c.mail_postcode,
      Country: c.mail_country,
    },
    Status: c.status,
    CustomFields: c.custom_fields ?? [],
  };
}

export function formatSite(s: SimproSite, ss: SimproStore): object {
  const customer = ss.customers.get(s.customer_id);
  return {
    ID: s.id,
    Name: s.name,
    Customer: {
      ID: s.customer_id,
      CompanyName: customer?.company_name ?? "",
    },
    Address: {
      Address: s.address,
      Suburb: s.suburb,
      State: s.state,
      Postcode: s.postcode,
      Country: s.country,
    },
    Contact: {
      Name: s.contact_name,
      Phone: s.contact_phone,
      Email: s.contact_email,
    },
  };
}

export function formatJobCostCenter(cc: JobCostCenter): object {
  return {
    ID: cc.id,
    Name: cc.name,
    CostCenter: { ID: cc.cost_center_id, Name: "" },
    LaborRate: { ID: cc.labor_rate_id ?? 0, Name: "" },
    TotalExTax: cc.total_ex_tax,
  };
}

export function formatSection(s: JobSection): object {
  return {
    ID: s.id,
    Name: s.name,
    CostCenters: (s.cost_centers ?? []).map(formatJobCostCenter),
  };
}

export function formatJob(j: SimproJob, ss: SimproStore): object {
  const customer = ss.customers.get(j.customer_id);
  const site = j.site_id ? ss.sites.get(j.site_id) : null;
  return {
    ID: j.id,
    Type: "Job",
    OrderNo: j.order_no,
    Description: j.description,
    Customer: {
      ID: j.customer_id,
      CompanyName: customer?.company_name ?? "",
    },
    Site: {
      ID: j.site_id ?? 0,
      Name: site?.name ?? "",
    },
    Stage: j.stage,
    Status: { ID: j.status_id ?? 0, Name: "" },
    DateIssued: formatDate(j.issued_date),
    DateDue: formatDate(j.due_date),
    TotalExTax: j.total_ex_tax,
    TotalIncTax: j.total_inc_tax,
    Tags: j.tags ?? [],
    Sections: (j.sections ?? []).map(formatSection),
  };
}

export function formatQuote(q: SimproQuote, ss: SimproStore): object {
  const customer = ss.customers.get(q.customer_id);
  const site = q.site_id ? ss.sites.get(q.site_id) : null;
  return {
    ID: q.id,
    Type: "Quote",
    OrderNo: q.order_no,
    Description: q.description,
    Customer: {
      ID: q.customer_id,
      CompanyName: customer?.company_name ?? "",
    },
    Site: {
      ID: q.site_id ?? 0,
      Name: site?.name ?? "",
    },
    Stage: q.stage,
    Status: { ID: q.status_id ?? 0, Name: "" },
    DateIssued: formatDate(q.issued_date),
    DateDue: formatDate(q.due_date),
    TotalExTax: q.total_ex_tax,
    TotalIncTax: q.total_inc_tax,
    ConvertedJob: q.converted_job_id ? { ID: q.converted_job_id } : null,
  };
}

export function formatInvoice(inv: SimproInvoice, ss: SimproStore): object {
  const customer = ss.customers.get(inv.customer_id);
  const job = inv.job_id ? ss.jobs.get(inv.job_id) : null;
  return {
    ID: inv.id,
    InvoiceNo: inv.invoice_no,
    Customer: {
      ID: inv.customer_id,
      CompanyName: customer?.company_name ?? "",
    },
    Job: {
      ID: inv.job_id ?? 0,
      OrderNo: job?.order_no ?? "",
    },
    Status: inv.status,
    TotalExTax: inv.total_ex_tax,
    TotalIncTax: inv.total_inc_tax,
    AmountPaid: inv.amount_paid,
    Balance: inv.balance,
    DateIssued: formatDate(inv.issued_date),
    DateDue: formatDate(inv.due_date),
  };
}

export function formatStaff(s: SimproStaff): object {
  return {
    ID: s.id,
    GivenName: s.given_name,
    FamilyName: s.family_name,
    Email: s.email,
    Phone: s.phone,
    Mobile: s.mobile,
    Role: { ID: s.role_id ?? 0, Name: s.role_name ?? "" },
    Status: s.status,
  };
}

export function formatContractor(c: SimproContractor): object {
  return {
    ID: c.id,
    CompanyName: c.company_name,
    GivenName: c.given_name,
    FamilyName: c.family_name,
    Email: c.email,
    Phone: c.phone,
    Status: c.status,
  };
}

export function formatSchedule(s: SimproSchedule, ss: SimproStore): object {
  const job = ss.jobs.get(s.job_id);
  const staff = s.staff_id ? ss.staff.get(s.staff_id) : null;
  return {
    ID: s.id,
    Job: { ID: s.job_id, OrderNo: job?.order_no ?? "" },
    CostCenter: { ID: s.cost_center_id ?? 0, Name: s.cost_center_name ?? "" },
    Staff: {
      ID: s.staff_id ?? 0,
      GivenName: staff?.given_name ?? "",
      FamilyName: staff?.family_name ?? "",
    },
    Date: s.date,
    Blocks: s.blocks ?? [],
    Notes: s.notes ?? "",
  };
}

export function formatAsset(a: SimproAsset, ss: SimproStore): object {
  const customer = ss.customers.get(a.customer_id);
  const site = a.site_id ? ss.sites.get(a.site_id) : null;
  return {
    ID: a.id,
    Name: a.name,
    AssetType: { ID: a.asset_type_id ?? 0, Name: a.asset_type_name ?? "" },
    Customer: {
      ID: a.customer_id,
      CompanyName: customer?.company_name ?? "",
    },
    Site: {
      ID: a.site_id ?? 0,
      Name: site?.name ?? "",
    },
    SerialNo: a.serial_no ?? "",
    ServiceLevel: { ID: a.service_level_id ?? 0, Name: a.service_level_name ?? "" },
    DateNextService: a.next_service_date ?? "",
    Status: a.status ?? "Active",
    DateInstalled: a.date_installed ?? "",
    CustomFields: a.custom_fields ?? [],
  };
}

export function formatCostCenter(cc: SimproCostCenter): object {
  return { ID: cc.id, Name: cc.name, Description: cc.description };
}

export function formatLaborRate(lr: SimproLaborRate): object {
  return { ID: lr.id, Name: lr.name, Rate: lr.rate };
}

export function formatTaxCode(tc: SimproTaxCode): object {
  return { ID: tc.id, Name: tc.name, Rate: tc.rate, Description: tc.description };
}

export function formatCatalogItem(ci: SimproCatalogItem): object {
  return {
    ID: ci.id,
    Name: ci.name,
    PartNo: ci.part_no,
    UnitPrice: ci.unit_price,
    CostCenter: { ID: ci.cost_center_id ?? 0, Name: "" },
    Description: ci.description,
  };
}

export function formatStatus(s: SimproStatus): object {
  return { ID: s.id, Name: s.name, Color: s.color };
}

export function formatZone(z: SimproZone): object {
  return { ID: z.id, Name: z.name, Description: z.description };
}

export function formatCustomField(cf: SimproCustomField): object {
  return { ID: cf.id, Name: cf.name, EntityType: cf.entity_type, FieldType: cf.field_type };
}

export function formatWebhook(w: SimproWebhook): object {
  return { ID: w.id, URL: w.url, Events: w.events, Active: w.active };
}
