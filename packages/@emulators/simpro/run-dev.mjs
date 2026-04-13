#!/usr/bin/env node
// Standalone dev runner for @emulators/simpro — bypasses emulate CLI build
// Usage: node run-dev.mjs [--port 4005] [--config path/to/emulate.config.yaml]
import { serve as createServer } from "@hono/node-server";
import { Hono } from "hono";
import { Store } from "@emulators/core";
import { simproPlugin, seedFromConfig } from "./dist/index.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const port = portIdx >= 0 ? parseInt(args[portIdx + 1], 10) : (parseInt(process.env.PORT ?? "4005", 10));
const configIdx = args.indexOf("--config");
const configPath = configIdx >= 0 ? resolve(process.cwd(), args[configIdx + 1]) : null;

const app = new Hono();
const store = new Store();

// Middleware: require Authorization header (any non-empty token)
app.use("/api/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth) {
    return c.json({ responseCode: 401, message: "Unauthorized" }, 401);
  }
  await next();
});

// Register simpro routes
const noop = () => {};
simproPlugin.register(app, store, { dispatch: noop }, `http://localhost:${port}`);

// Seed from config if provided
if (configPath && existsSync(configPath)) {
  const { parse } = await import("yaml");
  const yaml = readFileSync(configPath, "utf-8");
  const config = parse(yaml);
  if (config.simpro) {
    seedFromConfig(store, `http://localhost:${port}`, config.simpro);
    console.log(`✓ Seeded from ${configPath}`);
  } else {
    console.warn(`⚠ No 'simpro:' section found in ${configPath}`);
  }
} else {
  // Minimal default seed
  const { getSimproStore } = await import("./dist/index.js");
  const ss = getSimproStore(store);
  ss.costCenters.insert({ name: "General", description: "" });
  ss.taxCodes.insert({ name: "GST", rate: 10, description: "Goods and Services Tax" });
  ss.customers.insert({
    type: "Company", company_name: "Demo Building Services",
    email: "accounts@demobuild.com.au", phone1: "", phone2: "", mobile: "", fax: "",
    tax_number: "", mail_address: "", mail_suburb: "Melbourne", mail_state: "VIC",
    mail_postcode: "3000", mail_country: "Australia",
    given_name: "", family_name: "", payment_term: 30, payment_term_type: "Day",
    status: "Active", custom_fields: [],
  });
  console.log("✓ Seeded default data");
}

createServer({ fetch: app.fetch, port }, () => {
  console.log(`\n🔧 SimPRO emulator running at http://localhost:${port}/`);
  console.log(`   Inspector: http://localhost:${port}/`);
  console.log(`   API base:  http://localhost:${port}/api/v1.0/companies/0/\n`);
});
