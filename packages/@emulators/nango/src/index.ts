import type {
	AppEnv,
	ServicePlugin,
	Store,
	WebhookDispatcher,
} from "@emulators/core";
import type { Hono } from "hono";
import { connectionRoutes } from "./routes/connections.js";
import { directHubspotRoutes } from "./routes/direct-hubspot.js";
import { proxyRoutes } from "./routes/proxy.js";
import { sessionRoutes } from "./routes/sessions.js";
import { inspectorRoutes } from "./routes/inspector.js";
import { getNangoStore } from "./store.js";
import type { NangoConnection, NangoConnectionSeed } from "./types.js";

export type { NangoStoreFacade } from "./store.js";
export { getNangoStore } from "./store.js";
export type { NangoConnection, NangoConnectionSeed } from "./types.js";

export interface NangoSeedConfig {
	connections?: NangoConnectionSeed[];
}

export function seedFromConfig(
	store: Store,
	_baseUrl: string,
	config: NangoSeedConfig,
): void {
	const ns = getNangoStore(store);
	const now = new Date().toISOString();

	for (const seed of config.connections ?? []) {
		const existing = ns.getConnection(seed.id);
		if (existing) continue; // Skip duplicates

		const conn: NangoConnection = {
			id: seed.id,
			connection_id: seed.id,
			provider: seed.provider,
			provider_config_key: seed.provider_config_key,
			credentials: {
				access_token:
					seed.credentials?.access_token ?? `emulator-token-${seed.id}`,
				refresh_token:
					seed.credentials?.refresh_token ?? `emulator-refresh-${seed.id}`,
				expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
				type: "OAuth2",
			},
			connection_config: seed.connection_config ?? {},
			metadata: seed.metadata ?? {},
			created_at: now,
			updated_at: now,
		};
		ns.upsertConnection(conn);

		// Seed records per model
		for (const [model, rows] of Object.entries(seed.records ?? {})) {
			ns.setRecords(seed.id, model, rows);
		}
	}
}

export const nangoPlugin: ServicePlugin = {
	name: "nango",

	register(
		app: Hono<AppEnv>,
		store: Store,
		_webhooks: WebhookDispatcher,
		baseUrl: string,
	): void {
		const ns = getNangoStore(store);

		app.get("/health", (c) => c.json({ ok: true }));

		inspectorRoutes({ app, store, webhooks: _webhooks, baseUrl });
		connectionRoutes(app, ns);
		sessionRoutes(app, baseUrl, ns);
		proxyRoutes(app, ns);
		directHubspotRoutes(app, store);
	},

	seed(_store: Store, _baseUrl: string): void {
		// No default seed — connections are config-driven
	},
};
