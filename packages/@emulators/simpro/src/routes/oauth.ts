import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";

// In-memory code store — codes are short-lived and single-use
const pendingCodes = new Map<string, { redirectUri: string; issuedAt: number }>();

function generateCode(): string {
  return `emulator-code-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function generateToken(): string {
  return `emulator-token-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function oauthRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // -----------------------------------------------------------------------
  // OAuth 2.0 — Authorization endpoint
  // GET /oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&state=...
  // Auto-approves and immediately redirects back with a code.
  // -----------------------------------------------------------------------
  app.get("/oauth2/authorize", (c) => {
    const redirectUri = c.req.query("redirect_uri");
    const state = c.req.query("state") ?? "";

    if (!redirectUri) {
      return c.json({ error: "invalid_request", error_description: "redirect_uri is required" }, 400);
    }

    const code = generateCode();
    pendingCodes.set(code, { redirectUri, issuedAt: Date.now() });

    // Expire codes after 10 minutes
    setTimeout(() => pendingCodes.delete(code), 10 * 60 * 1000);

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    if (state) callbackUrl.searchParams.set("state", state);

    return c.redirect(callbackUrl.toString());
  });

  // -----------------------------------------------------------------------
  // OAuth 2.0 — Token endpoint
  // POST /oauth2/token
  // Accepts authorization_code or refresh_token grant types.
  // Always returns a valid token — no real validation needed for emulator.
  // -----------------------------------------------------------------------
  app.post("/oauth2/token", async (c) => {
    let grantType: string | undefined;
    let code: string | undefined;

    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await c.req.text();
      const params = new URLSearchParams(text);
      grantType = params.get("grant_type") ?? undefined;
      code = params.get("code") ?? undefined;
    } else {
      const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
      grantType = typeof body.grant_type === "string" ? body.grant_type : undefined;
      code = typeof body.code === "string" ? body.code : undefined;
    }

    if (!grantType) {
      return c.json({ error: "invalid_request", error_description: "grant_type is required" }, 400);
    }

    if (grantType === "authorization_code") {
      // Validate code exists (but don't reject unknown codes — emulator is permissive)
      if (code) pendingCodes.delete(code);
    } else if (grantType !== "refresh_token") {
      return c.json({ error: "unsupported_grant_type" }, 400);
    }

    const accessToken = generateToken();
    const refreshToken = generateToken();

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read write",
    });
  });

  // -----------------------------------------------------------------------
  // Identity — current user
  // GET /api/v1.0/:ignore/companies/:c/setup/users/current/
  // Called by Taskr after token exchange to identify the connecting user.
  // Returns first seeded staff member (or a synthetic admin if no staff).
  // Note: SimPRO uses an extra path segment before "companies" in this call.
  // -----------------------------------------------------------------------
  app.get("/api/v1.0/:ignore/companies/:c/setup/users/current/", (c) => {
    const allStaff = ss().staff.all();
    const first = allStaff[0];

    const user = first
      ? {
          ID: first.id,
          Username: first.email || `${first.given_name.toLowerCase()}.${first.family_name.toLowerCase()}`,
          Email: first.email,
          Firstname: first.given_name,
          Lastname: first.family_name,
          CompanyName: "SimPRO Emulator",
        }
      : {
          ID: 1,
          Username: "admin",
          Email: "admin@emulator.local",
          Firstname: "Admin",
          Lastname: "User",
          CompanyName: "SimPRO Emulator",
        };

    // SimPRO returns this as an array
    return c.json([user]);
  });
}
