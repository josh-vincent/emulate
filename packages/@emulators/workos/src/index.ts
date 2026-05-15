import type { AppEnv, ServicePlugin, Store, WebhookDispatcher } from "@emulators/core";
import type { Hono } from "hono";
import { discoveryRoutes } from "./routes/discovery.js";
import { invitationRoutes } from "./routes/invitations.js";
import { oauthRoutes } from "./routes/oauth.js";
import { sessionRoutes } from "./routes/sessions.js";
import { userRoutes } from "./routes/users.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { inspectorRoutes } from "./routes/inspector.js";
import { getWorkOSStore } from "./store.js";

export type { WorkOSStoreFacade } from "./store.js";
export { getWorkOSStore } from "./store.js";

export interface WorkOSSeedConfig {
  users?: Array<{
    id?: string;
    email: string;
    first_name?: string;
    last_name?: string;
    password?: string;
    profile_picture_url?: string;
    email_verified?: boolean;
  }>;
  organizations?: Array<{
    id?: string;
    name: string;
    slug?: string;
  }>;
  memberships?: Array<{
    user_email: string;
    organization_slug: string;
    role?: string;
  }>;
  oauth_clients?: Array<{
    client_id: string;
    client_secret?: string;
    name?: string;
    redirect_uris?: string[];
  }>;
  webhook_target?: string;
}

export function seedFromConfig(store: Store, _baseUrl: string, config: WorkOSSeedConfig): void {
  const ws = getWorkOSStore(store);

  for (const client of config.oauth_clients ?? []) {
    ws.insertOAuthClient({
      client_id: client.client_id,
      client_secret: client.client_secret,
      name: client.name ?? "Default App",
      redirect_uris: client.redirect_uris ?? ["http://localhost:3000/callback"],
    });
  }

  for (const org of config.organizations ?? []) {
    ws.insertOrganization({ id: org.id, name: org.name, slug: org.slug });
  }

  for (const user of config.users ?? []) {
    ws.insertUser({
      id: user.id,
      email: user.email,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      password: user.password,
      profile_picture_url: user.profile_picture_url ?? null,
      email_verified: user.email_verified,
    });
  }

  for (const m of config.memberships ?? []) {
    const user = ws.findUserByEmail(m.user_email);
    const org = ws.findOrgBySlug(m.organization_slug);
    if (user && org) {
      ws.insertMembership(user.id, org.id, m.role ?? "member");
    } else {
      console.warn(
        `[workos-emulator] Skipping membership: user=${m.user_email} org=${m.organization_slug} — not found`,
      );
    }
  }
}

export const workosPlugin: ServicePlugin = {
  name: "workos",

  register(app: Hono<AppEnv>, store: Store, webhooks: WebhookDispatcher, baseUrl: string): void {
    const ws = getWorkOSStore(store);

    app.get("/health", (c) => c.json({ ok: true }));

    inspectorRoutes({ app, store, webhooks, baseUrl });
    discoveryRoutes(app, baseUrl);
    oauthRoutes(app, ws, baseUrl);
    userRoutes(app, ws);
    sessionRoutes(app, ws);
    invitationRoutes(app, ws, webhooks);
    webhookRoutes(app);
  },

  seed(store: Store, _baseUrl: string): void {
    const ws = getWorkOSStore(store);
    // Default seed — single dev user so first-run works without config
    const user = ws.insertUser({
      id: "user_test_dev",
      email: "dev@taskrs.com.au",
      first_name: "Dev",
      last_name: "User",
      password: "DevPassword123!",
    });
    const org = ws.insertOrganization({
      id: "org_test_taskr",
      name: "Taskr Dev",
      slug: "taskr-dev",
    });
    ws.insertMembership(user.id, org.id, "owner");
    ws.insertOAuthClient({
      client_id: "client_test_01",
      client_secret: "sk_test_secret",
      name: "Taskr Local",
      redirect_uris: ["http://localhost:3000/callback", "taskr://auth/callback"],
    });
  },
};
