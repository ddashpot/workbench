/* Workbench — GitHub OAuth token-exchange Worker.
 *
 * The static front-end (GitHub Pages) cannot exchange the OAuth `code` for an
 * access token itself: GitHub's token endpoint requires the client_secret and
 * does not allow browser CORS. This Worker does that exchange server-side.
 *
 * Endpoint:  POST /api/github/token   body: { code, redirect_uri }
 *            -> { access_token, scope, token_type }  (GitHub's response, proxied)
 *
 * Secrets / vars (set via wrangler):
 *   GITHUB_CLIENT_ID      (var, public)    — set in wrangler.jsonc
 *   GITHUB_CLIENT_SECRET  (secret)         — `wrangler secret put GITHUB_CLIENT_SECRET`
 */

const ALLOWED_ORIGINS = new Set([
  "https://workapps.ddashpot.com",
  "https://ddashpot.github.io",
  "http://localhost:4178",
  "http://127.0.0.1:4178",
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://workapps.ddashpot.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "workbench-oauth" }, 200, origin);
    }
    if (url.pathname !== "/api/github/token" || request.method !== "POST") {
      return json({ error: "not_found" }, 404, origin);
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return json({ error: "server_misconfigured", error_description: "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set" }, 500, origin);
    }

    let body;
    try { body = await request.json(); } catch (_) { body = {}; }
    const code = body && body.code;
    if (!code) return json({ error: "missing_code" }, 400, origin);

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    });
    if (body.redirect_uri) params.set("redirect_uri", body.redirect_uri);

    let ghRes, data;
    try {
      ghRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "workbench-oauth-worker",
        },
        body: params.toString(),
      });
      data = await ghRes.json();
    } catch (e) {
      return json({ error: "upstream_error", error_description: String(e) }, 502, origin);
    }

    // GitHub returns { error } in the body (HTTP 200) on bad code, so surface that.
    const status = data && data.error ? 400 : 200;
    return json(data, status, origin);
  },
};
