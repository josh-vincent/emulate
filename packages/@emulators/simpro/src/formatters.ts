import type {
  SimproAsset,
  SimproCatalogItem,
  SimproContact,
  SimproContractor,
  SimproCostCenter,
  SimproCustomer,
  SimproInvoice,
  SimproJob,
  SimproLabourItem,
  SimproLabourRate,
  SimproMasterCostCenter,
  SimproOneOffItem,
  SimproPrebuildItem,
  SimproQuote,
  SimproSchedule,
  SimproSection,
  SimproSite,
  SimproStaff,
  SimproStatus,
  SimproStockItem,
  SimproTaxCode,
} from "./entities.js";
import type { SimproStore } from "./store.js";

/**
 * PascalCase translators: snake_case store row → Simpro API PascalCase shape.
 * The `display=all` flag controls whether nested Sections / Items are expanded.
 */

const dateOnly = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
};

export function formatCustomerRef(customer: SimproCustomer | undefined) {
  if (!customer) return null;
  return {
    ID: customer.external_id,
    CompanyName: customer.company_name,
    GivenName: customer.given_name,
    FamilyName: customer.family_name,
  };
}

export function formatSiteRef(site: SimproSite | undefined) {
  if (!site) return null;
  return { ID: site.external_id, Name: site.name };
}

export function formatContactRef(contact: SimproContact | undefined) {
  if (!contact) return null;
  return {
    ID: contact.external_id,
    GivenName: contact.given_name,
    FamilyName: contact.family_name,
  };
}

export function formatStaffRef(staff: SimproStaff | undefined) {
  if (!staff) return null;
  return {
    ID: staff.external_id,
    Name: `${staff.given_name} ${staff.family_name}`.trim(),
  };
}

export function formatStatus(status: SimproStatus | undefined) {
  if (!status) return null;
  return { ID: status.external_id, Name: status.name };
}

export function formatTaxCodeRef(tc: SimproTaxCode | undefined) {
  if (!tc) return null;
  return { ID: tc.external_id, Name: tc.name };
}

export function formatMasterCostCenterRef(cc: SimproMasterCostCenter | undefined) {
  if (!cc) return null;
  return { ID: cc.external_id, Name: cc.name };
}

export function formatMasterCostCenter(cc: SimproMasterCostCenter) {
  return {
    ID: cc.external_id,
    Name: cc.name,
    Archived: cc.archived,
    IncomeAccount: cc.income_account,
    ExpenseAccount: cc.expense_account,
  };
}

export function formatTaxCode(tc: SimproTaxCode) {
  return { ID: tc.external_id, Name: tc.name, Rate: tc.rate };
}

export function formatLabourRate(lr: SimproLabourRate) {
  return { ID: lr.external_id, Name: lr.name, Rate: lr.rate };
}

export function formatCustomer(c: SimproCustomer) {
  const base = {
    ID: c.external_id,
    Archived: c.archived,
    Email: c.email,
    Phone: { Primary: c.phone_primary },
    Address: c.address,
    Tags: c.tags,
    CustomFields: c.custom_fields,
  };
  if (c.type === "company") {
    return {
      ...base,
      CompanyName: c.company_name,
      EIN: c.ein,
      Website: c.website,
      PaymentTerms: c.payment_terms,
    };
  }
  return {
    ...base,
    Title: c.title,
    GivenName: c.given_name,
    FamilyName: c.family_name,
  };
}

export function formatSite(s: SimproSite, contact?: SimproContact) {
  return {
    ID: s.external_id,
    Name: s.name,
    Address: s.address,
    Contact: contact
      ? {
          ID: contact.external_id,
          GivenName: contact.given_name,
          FamilyName: contact.family_name,
          Phone: { Primary: contact.phone_primary },
          Email: contact.email,
        }
      : null,
    Archived: s.archived,
  };
}

export function formatStaff(s: SimproStaff) {
  return {
    ID: s.external_id,
    GivenName: s.given_name,
    FamilyName: s.family_name,
    Email: s.email,
    Active: s.active,
  };
}

export function formatContractor(c: SimproContractor) {
  return { ID: c.external_id, Name: c.name, Email: c.email, Archived: c.archived };
}

export interface FormatJobOptions {
  displayAll?: boolean;
  ss?: SimproStore;
}

export function formatJob(job: SimproJob, opts: FormatJobOptions = {}) {
  const { displayAll = false, ss } = opts;

  const customer = ss?.customers.findOneBy("external_id", job.customer_id);
  const site =
    job.site_id && ss ? ss.sites.findOneBy("external_id", job.site_id) ?? undefined : undefined;
  const customerContact =
    job.customer_contact_id && ss
      ? ss.contacts.findOneBy("external_id", job.customer_contact_id) ?? undefined
      : undefined;
  const siteContact =
    job.site_contact_id && ss
      ? ss.contacts.findOneBy("external_id", job.site_contact_id) ?? undefined
      : undefined;
  const salesperson =
    job.salesperson_id && ss
      ? ss.staff.findOneBy("external_id", job.salesperson_id) ?? undefined
      : undefined;
  const projectManager =
    job.project_manager_id && ss
      ? ss.staff.findOneBy("external_id", job.project_manager_id) ?? undefined
      : undefined;
  const status = job.status_id && ss ? ss.statuses.findOneBy("external_id", job.status_id) ?? undefined : undefined;
  const technicians = ss
    ? job.technician_ids
        .map((id) => ss.staff.findOneBy("external_id", id))
        .filter((t): t is SimproStaff => !!t)
        .map(formatStaffRef)
    : [];

  const base: Record<string, unknown> = {
    ID: job.external_id,
    Type: job.type,
    Name: job.name,
    Description: job.description,
    OrderNo: job.order_no,
    RequestNo: job.request_no,
    Customer: formatCustomerRef(customer),
    CustomerContact: formatContactRef(customerContact),
    Site: formatSiteRef(site),
    SiteContact: formatContactRef(siteContact),
    Salesperson: formatStaffRef(salesperson),
    ProjectManager: formatStaffRef(projectManager),
    Technicians: technicians,
    Stage: job.stage,
    Status: formatStatus(status),
    DateIssued: dateOnly(job.date_issued),
    DueDate: dateOnly(job.due_date),
    DueTime: job.due_time,
    Tags: job.tags,
    CustomFields: job.custom_fields,
    Total: {
      ExTax: job.total_ex_tax,
      Tax: job.total_tax,
      IncTax: job.total_inc_tax,
    },
    DateModified: job.date_modified,
  };

  if (displayAll && ss) {
    const sections = ss.sections
      .findBy("job_id", job.external_id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((section) => formatSection(section, { displayAll: true, ss }));
    base.Sections = sections;
  }

  return base;
}

export function formatSection(section: SimproSection, opts: FormatJobOptions = {}) {
  const { displayAll = false, ss } = opts;
  const base: Record<string, unknown> = {
    ID: section.external_id,
    Name: section.name,
    Description: section.description,
    DisplayOrder: section.display_order,
  };
  if (displayAll && ss) {
    base.CostCenters = ss.costCenters
      .findBy("section_id", section.external_id)
      .map((cc) => formatCostCenter(cc, { displayAll: true, ss }));
  }
  return base;
}

export function formatCostCenter(cc: SimproCostCenter, opts: FormatJobOptions = {}) {
  const { displayAll = false, ss } = opts;
  const masterCostCenter =
    cc.master_cost_center_id && ss
      ? ss.masterCostCenters.findOneBy("external_id", cc.master_cost_center_id) ?? undefined
      : undefined;
  const taxCode =
    cc.tax_code_id && ss ? ss.taxCodes.findOneBy("external_id", cc.tax_code_id) ?? undefined : undefined;

  const base: Record<string, unknown> = {
    ID: cc.external_id,
    Name: cc.name,
    CostCenter: formatMasterCostCenterRef(masterCostCenter),
    TaxCode: formatTaxCodeRef(taxCode),
    BillingType: cc.billing_type,
    Billable: cc.billable,
    Stage: cc.stage,
    ExTax: cc.ex_tax,
    Tax: cc.tax,
    IncTax: cc.inc_tax,
    InvoicedExTax: cc.invoiced_ex_tax,
    Markup: cc.markup,
    Discount: cc.discount,
    IsVariation: cc.is_variation,
    ContractorWorkOrderID: cc.contractor_work_order_id,
    DateModified: cc.date_modified,
  };

  if (displayAll && ss) {
    base.Items = {
      CatalogItems: ss.catalogItems.findBy("cost_center_id", cc.external_id).map(formatCatalogItem),
      LabourItems: ss.labourItems.findBy("cost_center_id", cc.external_id).map(formatLabourItem),
      OneOffItems: ss.oneOffItems.findBy("cost_center_id", cc.external_id).map(formatOneOffItem),
      PrebuildItems: ss.prebuildItems.findBy("cost_center_id", cc.external_id).map(formatPrebuildItem),
      ServiceFeeItems: [],
      StockItems: [],
    };
  }

  return base;
}

export function formatCatalogItem(item: SimproCatalogItem) {
  return {
    Type: "Catalog" as const,
    StockItemID: item.stock_item_id,
    Name: item.name,
    PartNo: item.part_no,
    Quantity: item.quantity,
    BasePrice: item.base_price,
    Markup: item.markup,
    SellPrice: item.sell_price,
    ExTax: item.ex_tax,
  };
}

export function formatLabourItem(item: SimproLabourItem) {
  return {
    Type: "Labour" as const,
    LabourID: item.labour_id,
    Name: item.name,
    Hours: item.hours,
    LabourRate: item.labour_rate,
    Markup: item.markup,
    SellPrice: item.sell_price,
    ExTax: item.ex_tax,
  };
}

export function formatOneOffItem(item: SimproOneOffItem) {
  return {
    Type: "OneOff" as const,
    Description: item.description,
    Quantity: item.quantity,
    EstCost: item.est_cost,
    ActCost: item.act_cost,
    Markup: item.markup,
    SellPrice: item.sell_price,
    ExTax: item.ex_tax,
  };
}

export function formatPrebuildItem(item: SimproPrebuildItem) {
  return {
    Type: "Prebuild" as const,
    PrebuildID: item.prebuild_id,
    Name: item.name,
    Quantity: item.quantity,
    CostPrice: item.cost_price,
    Markup: item.markup,
    SellPrice: item.sell_price,
    ExTax: item.ex_tax,
  };
}

export function formatStockItem(item: SimproStockItem) {
  return {
    ID: item.external_id,
    Name: item.name,
    PartNo: item.part_no,
    UnitPrice: item.unit_price,
  };
}

export function formatQuote(q: SimproQuote) {
  return {
    ID: q.external_id,
    Name: q.name,
    Customer: { ID: q.customer_id },
    Site: q.site_id ? { ID: q.site_id } : null,
    Stage: q.stage,
    Total: { ExTax: q.total_ex_tax, IncTax: q.total_inc_tax },
    DateIssued: dateOnly(q.date_issued),
    ConvertedJob: q.converted_job_id ? { ID: q.converted_job_id } : null,
  };
}

export function formatInvoice(i: SimproInvoice) {
  return {
    ID: i.external_id,
    Job: { ID: i.job_id },
    Type: i.type,
    Stage: i.stage,
    Total: { ExTax: i.total_ex_tax, IncTax: i.total_inc_tax },
    Paid: i.paid,
    DateIssued: dateOnly(i.date_issued),
  };
}

export function formatSchedule(s: SimproSchedule) {
  return {
    ID: s.external_id,
    Job: { ID: s.job_id },
    Section: s.section_id ? { ID: s.section_id } : null,
    CostCenter: s.cost_center_id ? { ID: s.cost_center_id } : null,
    Technician: { ID: s.technician_id },
    Date: s.date,
    StartTime: s.start_time,
    Duration: s.duration_minutes,
  };
}

export function formatAsset(a: SimproAsset) {
  return {
    ID: a.external_id,
    Name: a.name,
    Customer: { ID: a.customer_id },
    Site: a.site_id ? { ID: a.site_id } : null,
    AssetType: a.asset_type,
    SerialNumber: a.serial_number,
  };
}
