import { parse as parseYaml } from "yaml";
import { hasGenerator, generatorProviders } from "./generators.js";

// A scenario describes *what activity to stream and how fast*. It is the
// human-editable contract; the engine consumes only the normalised shape
// produced here, so all validation lives in one place. Which providers are
// valid is whatever the generator registry knows — so adding a provider is a
// `registerGenerator(...)` call (or a built-in entry), not a scenario-schema
// change.

/**
 * The original built-in inbox/messaging providers, kept exported for backward
 * compatibility. Validation no longer depends on these lists — any provider
 * with a registered generator is accepted (see `generatorProviders()`).
 */
export const SYNC_PROVIDERS = ["gmail", "graph-mail", "teams", "drive", "calendar"] as const;
/** Providers whose own webhook is wrapped + relayed (→ "forward" webhook). */
export const FORWARD_PROVIDERS = ["whatsapp"] as const;

export type Provider = string;

export interface Stream {
  name: string;
  kind: "sync" | "forward";
  provider: Provider;
  connectionId: string;
  providerConfigKey: string;
  /** sync streams only — the Nango model the record is appended to. */
  model?: string;
  /** forward streams only — the {environmentUuid} path segment Nango uses. */
  environmentUuid?: string;
  /** Normalised from `ratePerMinute`: ms between ticks. */
  intervalMs: number;
  /** Fractional jitter on the interval, clamped to [0,1]. */
  jitter: number;
  /** Optional cap on ticks emitted by this stream. */
  maxCount?: number;
}

export interface Scenario {
  /** Default emulator base URL (CLI `--base` overrides this). */
  base?: string;
  /** Optional global stop after this many seconds of wall time. */
  durationSec?: number;
  streams: Stream[];
}

interface RawStream {
  name?: string;
  kind?: string;
  provider?: string;
  connectionId?: string;
  providerConfigKey?: string;
  model?: string;
  environmentUuid?: string;
  ratePerMinute?: number;
  jitter?: number;
  maxCount?: number;
}

function fail(msg: string): never {
  throw new Error(`[emulate-sim] invalid scenario: ${msg}`);
}

function normaliseStream(raw: RawStream, i: number): Stream {
  const at = `streams[${i}]${raw.name ? ` "${raw.name}"` : ""}`;
  const kind = raw.kind;
  if (kind !== "sync" && kind !== "forward") fail(`${at}: kind must be "sync" or "forward"`);

  const provider = raw.provider as Provider;
  if (!provider || !hasGenerator(provider)) {
    fail(`${at}: unknown provider "${raw.provider}" (expected one of ${generatorProviders().join(", ")})`);
  }

  if (!raw.connectionId) fail(`${at}: connectionId is required`);
  if (!raw.providerConfigKey) fail(`${at}: providerConfigKey is required`);

  const rate = raw.ratePerMinute;
  if (typeof rate !== "number" || !(rate > 0)) fail(`${at}: ratePerMinute must be a positive number`);

  if (kind === "sync" && !raw.model) fail(`${at}: sync streams require a model`);
  if (kind === "forward" && !raw.environmentUuid) fail(`${at}: forward streams require an environmentUuid`);

  const jitter = Math.min(1, Math.max(0, raw.jitter ?? 0));

  return {
    name: raw.name ?? `${provider}-${i}`,
    kind,
    provider,
    connectionId: raw.connectionId,
    providerConfigKey: raw.providerConfigKey,
    model: raw.model,
    environmentUuid: raw.environmentUuid,
    intervalMs: 60_000 / rate,
    jitter,
    maxCount: raw.maxCount,
  };
}

/**
 * Parse + validate a scenario from YAML or JSON text. Throws an
 * `[emulate-sim] invalid scenario: …` error on the first problem.
 */
export function loadScenario(text: string): Scenario {
  let doc: unknown;
  try {
    doc = parseYaml(text); // YAML is a JSON superset — one parser does both.
  } catch (e) {
    fail(`could not parse as YAML/JSON: ${(e as Error).message}`);
  }
  if (!doc || typeof doc !== "object") fail("root must be an object");

  const obj = doc as { base?: unknown; durationSec?: unknown; streams?: unknown };
  if (!Array.isArray(obj.streams) || obj.streams.length === 0) {
    fail("at least one stream is required");
  }

  const streams = (obj.streams as RawStream[]).map(normaliseStream);
  const scenario: Scenario = { streams };
  if (typeof obj.base === "string") scenario.base = obj.base;
  if (typeof obj.durationSec === "number") scenario.durationSec = obj.durationSec;
  return scenario;
}
