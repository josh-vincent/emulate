import type { Entity } from "@emulators/core";

// ------- Nested structures (stored as JSON on parent entity) -------

export interface JobCostCenter {
  id: number;
  name: string;
  cost_center_id: number;
  labor_rate_id: number | null;
  total_ex_tax: number;
}

export interface JobSection {
  id: number;
  name: string;
  cost_centers: JobCostCenter[];
}

export interface ScheduleBlock {
  start: string; // "HH:MM"
  end: string;
}

export interface CustomFieldValue {
  custom_field_id: number;
  name: string;
  value: string;
}

// ------- Collections -------

export interface SimproCustomer extends Entity {
  type: "Company" | "Individual";
  company_name: string;
  given_name: string;
  family_name: string;
  phone1: string;
  phone2: string;
  mobile: string;
  fax: string;
  email: string;
  tax_number: string;
  mail_address: string;
  mail_suburb: string;
  mail_state: string;
  mail_postcode: string;
  mail_country: string;
  payment_term: number;
  payment_term_type: string;
  status: "Active" | "Inactive";
  custom_fields: CustomFieldValue[];
}

export interface SimproSite extends Entity {
  customer_id: number;
  name: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
}

export interface SimproJob extends Entity {
  type: "Job";
  order_no: string;
  description: string;
  customer_id: number;
  site_id: number | null;
  stage: "Pending" | "Progress" | "Complete" | "Void";
  status_id: number | null;
  issued_date: string;
  due_date: string;
  total_ex_tax: number;
  total_inc_tax: number;
  sections: JobSection[];
  tags: string[];
}

export interface SimproQuote extends Entity {
  order_no: string;
  description: string;
  customer_id: number;
  site_id: number | null;
  stage: "Pending" | "Approved" | "Rejected" | "Converted";
  status_id: number | null;
  issued_date: string;
  due_date: string;
  total_ex_tax: number;
  total_inc_tax: number;
  converted_job_id: number | null;
}

export interface SimproInvoice extends Entity {
  invoice_no: string;
  customer_id: number;
  job_id: number | null;
  status: "Draft" | "Issued" | "Paid" | "Void";
  total_ex_tax: number;
  total_inc_tax: number;
  amount_paid: number;
  balance: number;
  issued_date: string;
  due_date: string;
}

export interface SimproStaff extends Entity {
  given_name: string;
  family_name: string;
  email: string;
  phone: string;
  mobile: string;
  role_id: number | null;
  role_name: string;
  status: "Active" | "Inactive";
}

export interface SimproContractor extends Entity {
  company_name: string;
  given_name: string;
  family_name: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
}

export interface SimproSchedule extends Entity {
  job_id: number;
  cost_center_id: number | null;
  cost_center_name: string;
  staff_id: number | null;
  date: string; // YYYY-MM-DD
  blocks: ScheduleBlock[];
  notes: string;
}

export interface SimproAsset extends Entity {
  name: string;
  asset_type_id: number | null;
  asset_type_name: string;
  customer_id: number;
  site_id: number | null;
  serial_no: string;
  service_level_id: number | null;
  service_level_name: string;
  next_service_date: string;
  status: string;
  date_installed: string;
  custom_fields: CustomFieldValue[];
}

export interface SimproCostCenter extends Entity {
  name: string;
  description: string;
}

export interface SimproLaborRate extends Entity {
  name: string;
  rate: number;
}

export interface SimproTaxCode extends Entity {
  name: string;
  rate: number;
  description: string;
}

export interface SimproCatalogItem extends Entity {
  name: string;
  part_no: string;
  unit_price: number;
  cost_center_id: number | null;
  description: string;
}

export interface SimproStatus extends Entity {
  name: string;
  entity_type: "job" | "quote";
  color: string;
}

export interface SimproZone extends Entity {
  name: string;
  description: string;
}

export interface SimproCustomField extends Entity {
  name: string;
  entity_type: string;
  field_type: string;
}

export interface SimproWebhook extends Entity {
  url: string;
  events: string[];
  active: boolean;
  secret: string;
}
