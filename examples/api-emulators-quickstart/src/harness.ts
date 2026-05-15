// Tiny shared bootstrap so each provider demo stays a single readable file.
//
// Every emulator is just a `ServicePlugin` registered onto a Hono app backed
// by an in-memory `Store` — exactly how `@emulators/server` mounts them, but
// in-process so the demos run with zero setup (`pnpm --filter
// api-emulators-quickstart nango`). No ports, no Docker, no network.
import { Hono } from "hono";
import { Store, WebhookDispatcher } from "@emulators/core";
import type { ServicePlugin, TokenMap } from "@emulators/core";

export interface Emulator {
  app: Hono;
  store: Store;
}

export function mount(plugin: ServicePlugin, baseUrl: string): Emulator {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const tokenMap: TokenMap = new Map();
  const app = new Hono();
  plugin.register(app as never, store, webhooks, baseUrl, tokenMap);
  return { app, store };
}

export function heading(title: string): void {
  console.log(`\n${"═".repeat(64)}\n${title}\n${"═".repeat(64)}`);
}

const indent = (text: string): string =>
  text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

/**
 * Issues a request against the in-process emulator, prints the result the way
 * you'd inspect it in a REST client, and returns the parsed JSON body.
 */
export async function call(emu: Emulator, label: string, url: string, init?: RequestInit): Promise<unknown> {
  const res = await emu.app.request(url, init);
  const text = await res.text();
  const isJson = (res.headers.get("content-type") ?? "").includes("json");

  console.log(`\n▶ ${label}`);
  console.log(`  ${init?.method ?? "GET"} ${url}  →  ${res.status}`);

  let parsed: unknown = text;
  if (isJson && text) {
    parsed = JSON.parse(text);
    console.log(indent(JSON.stringify(parsed, null, 2)));
  } else if (text) {
    console.log(indent(text.length > 200 ? `${text.slice(0, 200)}… (${text.length} bytes)` : text));
  }
  return parsed;
}
