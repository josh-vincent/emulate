import type {
  UptickAsset,
  UptickAssetType,
  UptickClient,
  UptickDefect,
  UptickProperty,
  UptickUser,
} from "./entities.js";
import type { UptickStore } from "./store.js";

export interface JsonApiResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

function toRel(type: string, id: number | null | undefined): unknown {
  if (!id) return { data: null };
  return { data: { type, id: String(id) } };
}

export function formatClient(c: UptickClient): JsonApiResource {
  return {
    type: "Client",
    id: String(c.id),
    attributes: {
      name: c.name,
      is_active: c.is_active,
      sector: c.sector || null,
      ref: c.ref || null,
      contact_name: c.contact_name || null,
      contact_email: c.contact_email || null,
      created: c.created_at,
      updated: c.updated_at,
    },
  };
}

export function formatProperty(p: UptickProperty, _us: UptickStore): JsonApiResource {
  return {
    type: "Property",
    id: String(p.id),
    attributes: {
      name: p.name,
      is_active: p.is_active,
      address: {
        display: p.address_display || `${p.address_streetline}, ${p.address_city} ${p.address_state} ${p.address_postal_code}`.trim(),
        streetline: p.address_streetline || null,
        city: p.address_city || null,
        state: p.address_state || null,
        postal_code: p.address_postal_code || null,
        country: p.address_country || "AU",
        country_name: p.address_country === "AU" || !p.address_country ? "Australia" : p.address_country,
      },
      created: p.created_at,
      updated: p.updated_at,
    },
    relationships: {
      client: toRel("Client", p.client_id),
    },
  };
}

export function formatAsset(a: UptickAsset, _us: UptickStore): JsonApiResource {
  return {
    type: "Asset",
    id: String(a.id),
    attributes: {
      name: a.name,
      asset_number: a.asset_number || null,
      is_active: a.is_active,
      standard_maintenance: a.standard_maintenance || null,
      created: a.created_at,
      updated: a.updated_at,
    },
    relationships: {
      property: toRel("Property", a.property_id),
      client: toRel("Client", a.client_id),
      asset_type: toRel("AssetType", a.asset_type_id),
    },
  };
}

export function formatDefect(d: UptickDefect, _us: UptickStore): JsonApiResource {
  return {
    type: "Defect",
    id: String(d.id),
    attributes: {
      description: d.description,
      notes: d.notes || null,
      severity: d.severity || null,
      status: d.status || "open",
      created: d.created_at,
      updated: d.updated_at,
    },
    relationships: {
      asset: toRel("Asset", d.asset_id),
      property: toRel("Property", d.property_id),
      client: toRel("Client", d.client_id),
    },
  };
}

export function formatAssetType(t: UptickAssetType): JsonApiResource {
  return {
    type: "AssetType",
    id: String(t.id),
    attributes: {
      name: t.name,
      description: t.description || null,
    },
  };
}

export function formatUser(u: UptickUser): JsonApiResource {
  return {
    type: "User",
    id: String(u.id),
    attributes: {
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
    },
  };
}
