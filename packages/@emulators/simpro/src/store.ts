import { Store, type Collection } from "@emulators/core";
import type {
  SimproCustomer,
  SimproSite,
  SimproJob,
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

export interface SimproStore {
  customers: Collection<SimproCustomer>;
  sites: Collection<SimproSite>;
  jobs: Collection<SimproJob>;
  quotes: Collection<SimproQuote>;
  invoices: Collection<SimproInvoice>;
  staff: Collection<SimproStaff>;
  contractors: Collection<SimproContractor>;
  schedules: Collection<SimproSchedule>;
  assets: Collection<SimproAsset>;
  costCenters: Collection<SimproCostCenter>;
  laborRates: Collection<SimproLaborRate>;
  taxCodes: Collection<SimproTaxCode>;
  catalogItems: Collection<SimproCatalogItem>;
  statuses: Collection<SimproStatus>;
  zones: Collection<SimproZone>;
  customFields: Collection<SimproCustomField>;
  webhooks: Collection<SimproWebhook>;
}

export function getSimproStore(store: Store): SimproStore {
  return {
    customers: store.collection<SimproCustomer>("simpro.customers", ["email"]),
    sites: store.collection<SimproSite>("simpro.sites", ["customer_id"]),
    jobs: store.collection<SimproJob>("simpro.jobs", ["customer_id", "site_id"]),
    quotes: store.collection<SimproQuote>("simpro.quotes", ["customer_id"]),
    invoices: store.collection<SimproInvoice>("simpro.invoices", ["customer_id", "job_id"]),
    staff: store.collection<SimproStaff>("simpro.staff", ["email"]),
    contractors: store.collection<SimproContractor>("simpro.contractors"),
    schedules: store.collection<SimproSchedule>("simpro.schedules", ["job_id", "staff_id"]),
    assets: store.collection<SimproAsset>("simpro.assets", ["customer_id", "site_id"]),
    costCenters: store.collection<SimproCostCenter>("simpro.cost_centers"),
    laborRates: store.collection<SimproLaborRate>("simpro.labor_rates"),
    taxCodes: store.collection<SimproTaxCode>("simpro.tax_codes"),
    catalogItems: store.collection<SimproCatalogItem>("simpro.catalog_items"),
    statuses: store.collection<SimproStatus>("simpro.statuses", ["entity_type"]),
    zones: store.collection<SimproZone>("simpro.zones"),
    customFields: store.collection<SimproCustomField>("simpro.custom_fields"),
    webhooks: store.collection<SimproWebhook>("simpro.webhooks"),
  };
}
