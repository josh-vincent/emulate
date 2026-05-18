import { makeNativePlugin } from "@emulators/native-kit";
import { spec } from "./spec.js";

// Standalone direct-to-source trello emulator. Mount it and clients hit
// trello's real native paths (/c/H0TZyzbK, /b/abc123) behind a bearer token — no Nango envelope. The Nango
// emulator remains the alternative; this is the "go direct" option.

const built = makeNativePlugin(spec);

export const trelloPlugin = built.plugin;
export const seedFromConfig = built.seedFromConfig;
export const storeToSeedConfig = built.storeToSeedConfig;
export default trelloPlugin;
