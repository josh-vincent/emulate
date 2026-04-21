import { Store, type Collection } from "@emulators/core";
import type {
  SimproAsset,
  SimproAttachment,
  SimproCatalogItem,
  SimproCompany,
  SimproContact,
  SimproContractor,
  SimproCostCenter,
  SimproCreditNote,
  SimproCustomField,
  SimproCustomer,
  SimproInvoice,
  SimproJob,
  SimproLabourItem,
  SimproLabourRate,
  SimproMasterCostCenter,
  SimproOAuthCode,
  SimproOAuthToken,
  SimproOneOffItem,
  SimproPayment,
  SimproPrebuildItem,
  SimproQuote,
  SimproSchedule,
  SimproSection,
  SimproSite,
  SimproStaff,
  SimproStatus,
  SimproStockItem,
  SimproTaxCode,
  SimproVendor,
  SimproVendorOrder,
  SimproWebhookEvent,
  SimproWebhookSubscription,
  SimproZone,
} from "./entities.js";

export interface SimproStore {
  companies: Collection<SimproCompany>;
  masterCostCenters: Collection<SimproMasterCostCenter>;
  taxCodes: Collection<SimproTaxCode>;
  labourRates: Collection<SimproLabourRate>;
  statuses: Collection<SimproStatus>;
  customers: Collection<SimproCustomer>;
  sites: Collection<SimproSite>;
  contacts: Collection<SimproContact>;
  staff: Collection<SimproStaff>;
  contractors: Collection<SimproContractor>;
  jobs: Collection<SimproJob>;
  sections: Collection<SimproSection>;
  costCenters: Collection<SimproCostCenter>;
  catalogItems: Collection<SimproCatalogItem>;
  labourItems: Collection<SimproLabourItem>;
  oneOffItems: Collection<SimproOneOffItem>;
  prebuildItems: Collection<SimproPrebuildItem>;
  stockItems: Collection<SimproStockItem>;
  quotes: Collection<SimproQuote>;
  invoices: Collection<SimproInvoice>;
  customerPayments: Collection<SimproPayment>;
  creditNotes: Collection<SimproCreditNote>;
  vendors: Collection<SimproVendor>;
  vendorOrders: Collection<SimproVendorOrder>;
  schedules: Collection<SimproSchedule>;
  assets: Collection<SimproAsset>;
  zones: Collection<SimproZone>;
  customFields: Collection<SimproCustomField>;
  attachments: Collection<SimproAttachment>;
  oauthCodes: Collection<SimproOAuthCode>;
  oauthTokens: Collection<SimproOAuthToken>;
  webhookSubscriptions: Collection<SimproWebhookSubscription>;
  webhookEvents: Collection<SimproWebhookEvent>;
}

export function getSimproStore(store: Store): SimproStore {
  return {
    companies: store.collection<SimproCompany>("simpro.companies", ["company_id"]),
    masterCostCenters: store.collection<SimproMasterCostCenter>("simpro.master_cost_centers", [
      "company_id",
      "external_id",
    ]),
    taxCodes: store.collection<SimproTaxCode>("simpro.tax_codes", ["company_id", "external_id"]),
    labourRates: store.collection<SimproLabourRate>("simpro.labour_rates", ["company_id", "external_id"]),
    statuses: store.collection<SimproStatus>("simpro.statuses", ["company_id", "external_id", "kind"]),
    customers: store.collection<SimproCustomer>("simpro.customers", ["company_id", "external_id", "type"]),
    sites: store.collection<SimproSite>("simpro.sites", ["company_id", "external_id", "customer_id"]),
    contacts: store.collection<SimproContact>("simpro.contacts", [
      "company_id",
      "external_id",
      "site_id",
      "customer_id",
    ]),
    staff: store.collection<SimproStaff>("simpro.staff", ["company_id", "external_id"]),
    contractors: store.collection<SimproContractor>("simpro.contractors", ["company_id", "external_id"]),
    jobs: store.collection<SimproJob>("simpro.jobs", ["company_id", "external_id", "customer_id", "site_id"]),
    sections: store.collection<SimproSection>("simpro.sections", ["company_id", "external_id", "job_id"]),
    costCenters: store.collection<SimproCostCenter>("simpro.cost_centers", [
      "company_id",
      "external_id",
      "job_id",
      "section_id",
    ]),
    catalogItems: store.collection<SimproCatalogItem>("simpro.catalog_items", [
      "company_id",
      "external_id",
      "cost_center_id",
    ]),
    labourItems: store.collection<SimproLabourItem>("simpro.labour_items", [
      "company_id",
      "external_id",
      "cost_center_id",
    ]),
    oneOffItems: store.collection<SimproOneOffItem>("simpro.oneoff_items", [
      "company_id",
      "external_id",
      "cost_center_id",
    ]),
    prebuildItems: store.collection<SimproPrebuildItem>("simpro.prebuild_items", [
      "company_id",
      "external_id",
      "cost_center_id",
    ]),
    stockItems: store.collection<SimproStockItem>("simpro.stock_items", ["company_id", "external_id"]),
    quotes: store.collection<SimproQuote>("simpro.quotes", ["company_id", "external_id", "customer_id"]),
    invoices: store.collection<SimproInvoice>("simpro.invoices", ["company_id", "external_id", "job_id"]),
    customerPayments: store.collection<SimproPayment>("simpro.customer_payments", [
      "company_id",
      "external_id",
      "customer_id",
      "invoice_id",
    ]),
    creditNotes: store.collection<SimproCreditNote>("simpro.credit_notes", [
      "company_id",
      "external_id",
      "customer_id",
      "invoice_id",
      "job_id",
    ]),
    vendors: store.collection<SimproVendor>("simpro.vendors", ["company_id", "external_id"]),
    vendorOrders: store.collection<SimproVendorOrder>("simpro.vendor_orders", [
      "company_id",
      "external_id",
      "vendor_id",
      "job_id",
    ]),
    schedules: store.collection<SimproSchedule>("simpro.schedules", [
      "company_id",
      "external_id",
      "job_id",
      "technician_id",
    ]),
    assets: store.collection<SimproAsset>("simpro.assets", ["company_id", "external_id", "customer_id"]),
    zones: store.collection<SimproZone>("simpro.zones", ["company_id", "external_id"]),
    customFields: store.collection<SimproCustomField>("simpro.custom_fields", ["company_id", "external_id"]),
    attachments: store.collection<SimproAttachment>("simpro.attachments", [
      "company_id",
      "external_id",
      "parent_type",
      "parent_id",
    ]),
    oauthCodes: store.collection<SimproOAuthCode>("simpro.oauth_codes", ["code"]),
    oauthTokens: store.collection<SimproOAuthToken>("simpro.oauth_tokens", ["access_token", "refresh_token"]),
    webhookSubscriptions: store.collection<SimproWebhookSubscription>("simpro.webhook_subscriptions", [
      "company_id",
      "external_id",
    ]),
    webhookEvents: store.collection<SimproWebhookEvent>("simpro.webhook_events", [
      "company_id",
      "subscription_id",
      "event",
    ]),
  };
}
