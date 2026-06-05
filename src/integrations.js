/* Mock integrations for GitHub & Google Drive.
   GitHub now supports an OAuth-style connect flow (see src/components/OAuthModal.jsx).
   Real APIs not wired yet — these simulate the UX so the panels feel real. */

/* ===== GitHub OAuth config =====
   CLIENT_ID is a REAL, registered GitHub OAuth App client id (it is public —
   safe to ship in client code). The CLIENT SECRET is NOT here and must never be:
   it lives only in the server-side token-exchange endpoint (TOKEN_ENDPOINT).

   A pure static site cannot finish the OAuth Authorization Code flow on its own
   (GitHub blocks browser CORS on the token endpoint and OAuth Apps don't support
   PKCE), so completion still runs as a client-side simulation below until a real
   backend at TOKEN_ENDPOINT is deployed. To go fully real:
     1. On the OAuth App page, set the Authorization callback URL to REDIRECT_URI.
     2. Generate a client secret and store it in the backend (e.g. Cloudflare Worker).
     3. Point TOKEN_ENDPOINT at that backend and replace GitHubAuth.completeAuthorize. */
window.GITHUB_OAUTH = {
  CLIENT_ID: "Ov23lijkzJqAyqKoVt4C", // real OAuth App (owner: ddashpot)
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: ["repo", "delete_repo", "read:user", "user:email"],
  TOKEN_ENDPOINT: "https://workbench-oauth.ikymbiz.workers.dev/api/github/token", // Cloudflare Worker (exchanges code -> token server-side)
  AUTHORIZE_URL: "https://github.com/login/oauth/authorize",
};

/* Real GitHub OAuth (Authorization Code flow).
   Token persists for the current tab only (sessionStorage) — closing the tab
   signs out, which keeps the access token out of long-lived storage. */
window.GitHubAuth = {
  KEY: "wb.gh.session",
  STATE_KEY: "wb.gh.state",
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY)) || null; } catch (_) { return null; }
  },
  set(session) {
    sessionStorage.setItem(this.KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("wb-gh-auth-change", { detail: session }));
  },
  clear() {
    sessionStorage.removeItem(this.KEY);
    window.dispatchEvent(new CustomEvent("wb-gh-auth-change", { detail: null }));
  },

  /* True when the current page load is an OAuth redirect back from GitHub. */
  hasPendingCallback() {
    return new URLSearchParams(window.location.search).has("code");
  },

  /* Step 1: send the whole tab to GitHub's real consent screen. */
  redirectToAuthorize() {
    const cfg = window.GITHUB_OAUTH;
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(this.STATE_KEY, state);
    const url = `${cfg.AUTHORIZE_URL}?client_id=${encodeURIComponent(cfg.CLIENT_ID)}`
      + `&redirect_uri=${encodeURIComponent(cfg.REDIRECT_URI)}`
      + `&scope=${encodeURIComponent(cfg.SCOPES.join(" "))}`
      + `&state=${encodeURIComponent(state)}`
      + `&allow_signup=false`;
    window.location.assign(url);
  },

  _cleanUrl() {
    const clean = window.location.origin + window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, clean);
  },

  /* Step 2 (on return): exchange ?code -> access_token via the backend, then
     fetch the real GitHub user. Throws on any failure; always cleans the URL. */
  async handleCallback() {
    const cfg = window.GITHUB_OAUTH;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const ghError = params.get("error");
    if (!code) {
      if (ghError) { this._cleanUrl(); throw new Error(params.get("error_description") || ghError); }
      return null;
    }
    const expected = sessionStorage.getItem(this.STATE_KEY);
    sessionStorage.removeItem(this.STATE_KEY);
    if (!expected || state !== expected) { this._cleanUrl(); throw new Error("OAuth state mismatch"); }

    let res;
    try {
      res = await fetch(cfg.TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect_uri: cfg.REDIRECT_URI }),
      });
    } catch (e) {
      this._cleanUrl();
      throw new Error("Could not reach token endpoint (" + cfg.TOKEN_ENDPOINT + "). Is the backend deployed?");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { this._cleanUrl(); throw new Error(data.error_description || data.error || ("Token exchange failed: " + res.status)); }
    const token = data.access_token;
    if (!token) { this._cleanUrl(); throw new Error("No access_token returned from backend"); }

    let u = {};
    try {
      const ures = await fetch("https://api.github.com/user", {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
      });
      u = await ures.json();
    } catch (_) { /* identity fetch best-effort */ }

    const login = u.login || "github-user";
    const session = {
      token,
      user: {
        login,
        name: u.name || login,
        avatar: login.charAt(0).toUpperCase(),
        avatarUrl: u.avatar_url || null,
        htmlUrl: u.html_url || ("https://github.com/" + login),
      },
      scopes: data.scope ? data.scope.split(",") : cfg.SCOPES,
      issuedAt: Date.now(),
    };
    this.set(session);
    this._cleanUrl();
    return session;
  },
};

window.MOCK_GITHUB = {
  user: { login: "yamada-taro", name: "Yamada Taro", avatar: "Y" },
  repos: [
    { name: "portfolio-2026", desc: "Personal portfolio. Astro + Tailwind.", stars: 12, lang: "TypeScript", langColor: "#3178c6", updated: "2 hours ago", visibility: "public" },
    { name: "study-react-patterns", desc: "Notes on React patterns from production codebases.", stars: 4, lang: "JavaScript", langColor: "#f7df1e", updated: "yesterday", visibility: "public" },
    { name: "team-handbook", desc: "Engineering handbook (internal).", stars: 0, lang: "Markdown", langColor: "#888", updated: "3 days ago", visibility: "private" },
    { name: "ml-experiments", desc: "Weekend deep-learning notebooks.", stars: 28, lang: "Python", langColor: "#3572a5", updated: "1 week ago", visibility: "public" },
    { name: "todo-island", desc: "Island-architecture todo app demo.", stars: 1, lang: "HTML", langColor: "#e34c26", updated: "2 weeks ago", visibility: "public" },
  ],
  // Files for the first repo (and a few others), shown when user opens it.
  files: {
    "portfolio-2026": [
      { type: "dir", name: "src" },
      { type: "dir", name: "public" },
      { type: "file", name: "index.html", size: "1.2 KB" },
      { type: "file", name: "package.json", size: "640 B" },
      { type: "file", name: "tailwind.config.js", size: "320 B" },
      { type: "file", name: "README.md", size: "2.4 KB" },
      { type: "file", name: ".gitignore", size: "120 B" },
    ],
    "study-react-patterns": [
      { type: "dir", name: "examples" },
      { type: "file", name: "compound-components.md", size: "8.1 KB" },
      { type: "file", name: "render-props.md", size: "3.4 KB" },
      { type: "file", name: "README.md", size: "1.1 KB" },
    ],
    "todo-island": [
      { type: "file", name: "index.html", size: "2.0 KB",
        content: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Todo Island</title>
<link rel="stylesheet" href="styles.css"></head>
<body>
<main>
  <h1>Todos</h1>
  <form id="f"><input id="i" placeholder="..."><button>Add</button></form>
  <ul id="list"></ul>
</main>
<script src="app.js"></script>
</body></html>` },
      { type: "file", name: "styles.css", size: "0.8 KB",
        content: `body{font-family:system-ui;max-width:480px;margin:48px auto;padding:0 16px;color:#111}
h1{font-size:28px;letter-spacing:-.02em}
form{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;padding:10px;border:1px solid #ddd;border-radius:8px}
button{padding:10px 14px;background:#111;color:#fff;border:0;border-radius:8px;cursor:pointer}
ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:6px}
li{padding:10px;border:1px solid #eee;border-radius:8px}` },
      { type: "file", name: "app.js", size: "0.5 KB",
        content: `const list = document.getElementById("list");
const form = document.getElementById("f");
const inp = document.getElementById("i");
const todos = [];
form.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(!inp.value.trim()) return;
  todos.push(inp.value.trim()); inp.value=""; render();
});
function render(){
  list.innerHTML = todos.map(t=>\`<li>\${t}</li>\`).join("");
}` },
      { type: "file", name: "README.md", size: "0.3 KB" },
    ],
  },
};

window.MOCK_GDRIVE = {
  user: { email: "yamada@example.com", name: "Yamada Taro" },
  files: [
    { type: "folder", name: "Projects" },
    { type: "folder", name: "Design References" },
    { type: "file", name: "Landing page wireframe.fig", icon: "fig", size: "4.2 MB", mod: "today" },
    { type: "file", name: "Brand guidelines.pdf", icon: "pdf", size: "1.8 MB", mod: "yesterday" },
    { type: "file", name: "Hero copy v3.docx", icon: "doc", size: "32 KB", mod: "2 days ago" },
    { type: "file", name: "Component spec.gdoc", icon: "gdoc", size: "—", mod: "3 days ago" },
    { type: "file", name: "Color palette.png", icon: "img", size: "240 KB", mod: "1 week ago",
      asset: "/* Imported palette */\n:root{\n  --p1:#0f172a; --p2:#1e293b; --p3:#3b82f6; --p4:#06b6d4; --p5:#fafafa;\n}" },
    { type: "file", name: "Icons set.svg", icon: "svg", size: "84 KB", mod: "1 week ago" },
  ],
};
