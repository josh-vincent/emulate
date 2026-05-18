import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { Store, WebhookDispatcher } from "@emulators/core";
import { makeNativePlugin, type NativeSpec } from "../index.js";

const base = "http://localhost:4000";

const spec: NativeSpec = {
  name: "demo",
  tokenPath: "/oauth/token",
  tokenPrefix: "demo",
  models: [
    {
      model: "Widget",
      collectionPath: "/v1/widgets",
      idField: "id",
      rows: [
        { id: "w1", name: "Alpha" },
        { id: "w2", name: "Beta" },
      ],
    },
  ],
};

function mk() {
  const { plugin, seedFromConfig, storeToSeedConfig } = makeNativePlugin(spec);
  const store = new Store();
  const app = new Hono();
  plugin.register(app as never, store, new WebhookDispatcher(), base);
  return { app, store, plugin, seedFromConfig, storeToSeedConfig };
}

describe("native-kit makeNativePlugin", () => {
  it("issues a bearer token at the configured token path", async () => {
    const { app } = mk();
    const r = await app.request(`${base}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    expect(r.status).toBe(200);
    const b = (await r.json()) as { access_token: string; token_type: string };
    expect(b.access_token.startsWith("demo_at_")).toBe(true);
    expect(b.token_type).toBe("bearer");
  });

  it("serves seeded rows at the native collection path and enforces bearer", async () => {
    const { app, store, plugin } = mk();
    plugin.seed?.(store, base);

    const unauth = await app.request(`${base}/v1/widgets`);
    expect(unauth.status).toBe(401);

    const r = await app.request(`${base}/v1/widgets`, { headers: { Authorization: "Bearer x" } });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { data: unknown[]; total: number; model: string };
    expect(body.total).toBe(2);
    expect(body.model).toBe("Widget");
  });

  it("supports create / read / update / delete", async () => {
    const { app, store, plugin } = mk();
    plugin.seed?.(store, base);
    const auth = { Authorization: "Bearer x", "Content-Type": "application/json" };

    const c = await app.request(`${base}/v1/widgets`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ id: "w3", name: "Gamma" }),
    });
    expect(c.status).toBe(201);

    const g = await app.request(`${base}/v1/widgets/w3`, { headers: auth });
    expect(g.status).toBe(200);
    expect(((await g.json()) as { name: string }).name).toBe("Gamma");

    const p = await app.request(`${base}/v1/widgets/w3`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ name: "Gamma2" }),
    });
    expect(((await p.json()) as { name: string }).name).toBe("Gamma2");

    const d = await app.request(`${base}/v1/widgets/w3`, { method: "DELETE", headers: auth });
    expect(d.status).toBe(204);
    const gone = await app.request(`${base}/v1/widgets/w3`, { headers: auth });
    expect(gone.status).toBe(404);
  });

  it("storeToSeedConfig round-trips through seedFromConfig", async () => {
    const { app, store, plugin, seedFromConfig, storeToSeedConfig } = mk();
    plugin.seed?.(store, base);
    await app.request(`${base}/v1/widgets`, {
      method: "POST",
      headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
      body: JSON.stringify({ id: "w9", name: "Zeta" }),
    });

    const exported = storeToSeedConfig(store, base);
    expect(exported.records?.Widget?.length).toBe(3);

    const fresh = new Store();
    seedFromConfig(fresh, base, exported);
    const fa = new Hono();
    plugin.register(fa as never, fresh, new WebhookDispatcher(), base);
    const r = await fa.request(`${base}/v1/widgets`, { headers: { Authorization: "Bearer x" } });
    expect(((await r.json()) as { total: number }).total).toBe(3);
  });
});
