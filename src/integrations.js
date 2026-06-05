/* Mock integrations for GitHub & Google Drive.
   GitHub now supports an OAuth-style connect flow (see src/components/OAuthModal.jsx).
   Real APIs not wired yet — these simulate the UX so the panels feel real. */

/* ===== GitHub OAuth config =====
   In a real deployment, set OAUTH_CLIENT_ID and host a server endpoint that
   exchanges the `code` for an access token (the client_secret stays server-side).
   Here we simulate the entire flow client-side so the UX is realistic. */
window.GITHUB_OAUTH = {
  CLIENT_ID: "Iv1.workbench-demo-client",
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: ["repo", "delete_repo", "read:user", "user:email"],
  TOKEN_ENDPOINT: "/api/github/token", // real backend would live here
  AUTHORIZE_URL: "https://github.com/login/oauth/authorize",
};

/* In-memory token store (mirrors the pasted-code's "memory only" pattern).
   Token persists for the current tab only (sessionStorage). */
window.GitHubAuth = {
  KEY: "wb.gh.session",
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
  /* Generates a fake state token for CSRF protection (the real flow would
     check this matches in the OAuth callback). */
  beginAuthorize() {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("wb.gh.state", state);
    return state;
  },
  /* In a real flow this would hit `${TOKEN_ENDPOINT}` with the `code`.
     Here we mint a fake token and resolve after a short delay so the loading
     state is visible. */
  async completeAuthorize({ code, state }) {
    const expected = sessionStorage.getItem("wb.gh.state");
    if (expected && state !== expected) throw new Error("OAuth state mismatch");
    sessionStorage.removeItem("wb.gh.state");
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    const session = {
      token: "gho_" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14),
      user: window.MOCK_GITHUB.user,
      scopes: window.GITHUB_OAUTH.SCOPES,
      issuedAt: Date.now(),
      expiresIn: 8 * 60 * 60 * 1000, // 8h
    };
    this.set(session);
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
