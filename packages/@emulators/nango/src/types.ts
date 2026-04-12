export interface NangoConnection {
  id: string;
  connection_id: string;
  provider: string;
  provider_config_key: string;
  credentials: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    type?: string;
  };
  connection_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Seeded records per connection per model name. */
export type NangoRecordsMap = Record<string, Record<string, unknown>[]>;

export interface NangoConnectionSeed {
  id: string;
  provider: string;
  provider_config_key: string;
  credentials?: {
    access_token?: string;
    refresh_token?: string;
  };
  connection_config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  records?: NangoRecordsMap;
}
