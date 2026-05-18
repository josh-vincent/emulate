import { makeNativePlugin } from "@emulators/native-kit";
import { spec } from "./spec.js";

// Standalone direct-to-source clickup emulator. Mount it and clients hit
// clickup's real native paths (/t) behind a bearer token — no Nango envelope. The Nango
// emulator remains the alternative; this is the "go direct" option.

const built = makeNativePlugin(spec);

export const clickupPlugin = built.plugin;
export const seedFromConfig = built.seedFromConfig;
export const storeToSeedConfig = built.storeToSeedConfig;
export default clickupPlugin;
