# workbench-oauth — GitHub OAuth token-exchange Worker

Cloudflare Worker that completes the GitHub OAuth Authorization Code flow for the
static Workbench front-end. It receives the `code` from the browser, exchanges it
for an access token using the **client secret** (kept server-side only), and
returns the token. The browser then calls `api.github.com/user` itself.

## Endpoint
```
POST /api/github/token
Body: { "code": "<oauth code>", "redirect_uri": "https://workapps.ddashpot.com/workbench/" }
->    { "access_token": "...", "scope": "repo,...", "token_type": "bearer" }
```

## One-time setup

1. **Register the callback URL** on the OAuth App (owner `ddashpot`, Client ID `Ov23lijkzJqAyqKoVt4C`):
   - GitHub → Settings → Developer settings → OAuth Apps → *workbench*
   - **Authorization callback URL** = `https://workapps.ddashpot.com/workbench/`
   - Generate a **Client secret** (copy it once).

2. **Deploy the Worker** (run OUTSIDE OneDrive to avoid file-lock issues):
   ```bash
   cd worker
   npx wrangler deploy
   ```
   Note the deployed URL, e.g. `https://workbench-oauth.<your-subdomain>.workers.dev`.

3. **Set the client secret** (interactive prompt — the value is never stored in the repo):
   ```bash
   npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

4. **Point the front-end at the Worker.** In `../src/integrations.js` set:
   ```js
   TOKEN_ENDPOINT: "https://workbench-oauth.<your-subdomain>.workers.dev/api/github/token",
   ```
   then commit & push (GitHub Pages redeploys automatically).

## CORS
Allowed origins are hard-coded in `src/index.js` (`ALLOWED_ORIGINS`):
`https://workapps.ddashpot.com`, `https://ddashpot.github.io`, and localhost:4178
for local testing. Add origins there if the site moves.

## Security notes
- `GITHUB_CLIENT_ID` is public (in `wrangler.jsonc`). `GITHUB_CLIENT_SECRET` is a
  Worker **secret** — never commit it.
- The access token is returned to the browser and stored in `sessionStorage`
  (cleared when the tab closes). For stricter handling, switch to an
  HttpOnly-cookie session issued by this Worker.
