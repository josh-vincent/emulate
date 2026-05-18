# @emulators/simulator

An external activity driver for a running [`emulate`](https://emulate.dev)
deployment. It streams new records/events into the emulator over time — emails
into an inbox, Teams messages, WhatsApp inbound, Drive files, Calendar events —
by hitting the public Nango API (record append + sync/forward webhooks).

It imports nothing from the emulator: a pure HTTP client that drives any
deployment. The consuming project owns the scenario and the data it pushes.

## CLI

```bash
emulate-sim run <scenario.yaml> [options]

  --base <url>        Emulator base URL (overrides scenario `base:`)
  --once              Fire exactly one tick per stream, then exit
  --dry-run           Generate + log, make no HTTP calls
  --duration <sec>    Stop after N seconds (overrides scenario `durationSec`)
```

`Ctrl-C` (SIGINT/SIGTERM) stops a continuous run gracefully.

## Scenario

YAML or JSON. See [`examples/inbox-stream.yaml`](./examples/inbox-stream.yaml).

| Field | Notes |
|---|---|
| `base` | Default emulator base URL (CLI `--base` wins). |
| `durationSec` | Optional global stop. |
| `streams[].kind` | `sync` (append a record + fire a `sync` webhook) or `forward` (wrap+relay a provider webhook). |
| `streams[].provider` | `gmail` · `graph-mail` · `teams` · `drive` · `calendar` (sync) · `whatsapp` (forward). |
| `streams[].connectionId` / `providerConfigKey` | Must match a Nango connection the emulator is seeded with. |
| `streams[].model` | Required for `sync` (the Nango model appended to). |
| `streams[].environmentUuid` | Required for `forward` (the inbound URL path segment). |
| `streams[].ratePerMinute` | Tick rate; normalised to an interval. |
| `streams[].jitter` | Fractional jitter on the interval, clamped to `[0,1]`. |
| `streams[].maxCount` | Optional per-stream tick cap. |

## Programmatic

```ts
import { loadScenario, Simulator } from "@emulators/simulator";

const sim = new Simulator(loadScenario(yamlText), { base: "http://emu/nango" });
const done = sim.start(); // resolves on maxCount / duration / sim.stop()
```

Everything non-deterministic (clock, timer, `fetch`, RNG) is injectable for
reproducible runs and tests.

Apache-2.0
