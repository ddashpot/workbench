#!/usr/bin/env node
// server.js — Workbench backend (Claude Code CLI, agent style)
//
// Serves the Workbench static UI (the parent folder) and bridges its chat to the
// `claude` CLI running as an AGENT inside a project directory on disk:
//   1. Serve ../  (index.html + src/ + styles.css).
//   2. One WebSocket per browser.
//   3. Each prompt spawns `claude -p ... --output-format stream-json` (resuming),
//      letting the agent edit real files; every privileged tool use passes
//      through the human approval gate (permission-mcp.js -> /internal/permission).
//   4. After edits / each turn, snapshot the project's files and push them to the
//      UI so the preview + code panels reflect what's on disk.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Static root = the Workbench folder (parent of server/).
const STATIC_ROOT = path.join(__dirname, "..");

// ---- config ---------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "4317", 10);
// Directory the agent operates in. THIS IS WHERE FILES GET EDITED — be careful.
// Mutable: the operator can switch the project from the UI (set_workdir).
// Projects live as subfolders of PROJECTS_ROOT; WORKDIR = the active project.
// Default (no env) = ../dd-web-builder next to the Workbench folder.
const PROJECTS_ROOT = path.resolve(
  process.env.CLAUDE_UI_PROJECTS || process.env.CLAUDE_UI_CWD || path.join(STATIC_ROOT, "..", "dd-web-builder")
);
let WORKDIR = PROJECTS_ROOT; // reassigned to the active project by ensureActive()
let MODEL = process.env.CLAUDE_UI_MODEL || "";

// Workbench's preview inlines exactly these three files (see buildSrcDoc).
const PREVIEW_FILES = ["index.html", "styles.css", "app.js"];

// Layered-prompt inputs mirrored from the UI; written into <WORKDIR>/CLAUDE.md.
let CUSTOM = "";
let LANG = "ja";
let TARGET = "pc";

// Persistent prompt/skill config: { app, global, projects: { name: { prompt, skills:[] } } }
const CONFIG_DIR = path.join(PROJECTS_ROOT, ".workbench");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const SKILLS_DIR = path.resolve(path.join(STATIC_ROOT, "..", "skills"));
const DEFAULT_APP_PROMPT = `This is a single-page web app shown in a live preview. Keep the project as exactly three files at the project root and edit them in place:
- index.html  (must link styles.css and app.js)
- styles.css
- app.js
Do not add a build step, frameworks, or extra files unless explicitly asked.`;

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {}; } catch (_) { return {}; }
}
function saveConfig() {
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2)); } catch (_) {}
}
let CONFIG = loadConfig();
function projCfg(name) {
  CONFIG.projects = CONFIG.projects || {};
  CONFIG.projects[name] = CONFIG.projects[name] || {};
  return CONFIG.projects[name];
}

// Write the MCP config that points Claude Code at our permission server.
const MCP_CONFIG_PATH = path.join(os.tmpdir(), `wb-ui-mcp-${PORT}.json`);
fs.writeFileSync(
  MCP_CONFIG_PATH,
  JSON.stringify({
    mcpServers: {
      approval: {
        command: "node",
        args: [path.join(__dirname, "permission-mcp.js")],
        env: { UI_SERVER_PORT: String(PORT) }
      }
    }
  })
);

// ---- per-connection state -------------------------------------------------
let sessionId = null;
let activeChild = null;
const allowAlways = new Set();
const pendingPermissions = new Map();
const toolNames = new Map(); // tool_use_id -> tool name (to detect edits)

// ---- project file snapshot ------------------------------------------------
function snapshotFiles() {
  const files = {};
  for (const name of PREVIEW_FILES) {
    try {
      const p = path.join(WORKDIR, name);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        files[name] = fs.readFileSync(p, "utf8");
      }
    } catch (_) { /* skip unreadable */ }
  }
  return files;
}
function pushFiles() {
  sendUI({ type: "files_changed", files: snapshotFiles() });
}
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Update"]);

// ---- layered prompt -> CLAUDE.md ------------------------------------------
function composedClaudeMd(name) {
  const lang = LANG === "ja" ? "日本語" : "English";
  const target = TARGET === "mobile"
    ? "Mobile (portrait, ~390px). Mobile-first, large touch targets."
    : "Desktop. Wider grids and hover states.";
  const cfg = projCfg(name);
  const app = (CONFIG.app && CONFIG.app.trim()) ? CONFIG.app.trim() : DEFAULT_APP_PROMPT;
  const global = (CONFIG.global || "").trim();
  const project = (cfg.prompt || "").trim();
  const skills = cfg.skills || [];
  let md = `# Project instructions (managed by Workbench — do not hand-edit)\n\n`;
  md += `## App\n${app}\n\nExplain your work in ${lang}. Target form factor: ${target}\n`;
  if (global) md += `\n## Global (applies to all your projects)\n${global}\n`;
  if (project) md += `\n## This project\n${project}\n`;
  if (CUSTOM && CUSTOM.trim()) md += `\n## Notes\n${CUSTOM.trim()}\n`;
  if (skills.length) md += `\n## Enabled skills\nThese skills are available under .claude/skills/ — use them when relevant:\n${skills.map((s) => "- " + s).join("\n")}\n`;
  return md;
}
function writeClaudeMd() {
  try { fs.writeFileSync(path.join(WORKDIR, "CLAUDE.md"), composedClaudeMd(activeName())); } catch (_) {}
}
function sendPrompts() {
  const cfg = projCfg(activeName());
  sendUI({ type: "prompts", app: CONFIG.app || "", defaultApp: DEFAULT_APP_PROMPT, global: CONFIG.global || "", project: cfg.prompt || "" });
}

// ---- skills (import from the shared skills/ catalog) -----------------------
function skillDesc(p) {
  try {
    const txt = fs.readFileSync(p, "utf8");
    const m = txt.match(/^description:\s*(.+)$/mi);
    if (m) return m[1].replace(/^["']|["']$/g, "").trim().slice(0, 160);
    const line = txt.split("\n").find((l) => l.trim() && !l.startsWith("---") && !l.startsWith("name:"));
    return (line || "").replace(/^#+\s*/, "").slice(0, 160);
  } catch (_) { return ""; }
}
function listSkills() {
  try {
    return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, "SKILL.md")))
      .map((d) => ({ name: d.name, desc: skillDesc(path.join(SKILLS_DIR, d.name, "SKILL.md")) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (_) { return []; }
}
function sendSkills() {
  sendUI({ type: "skills", available: listSkills(), enabled: projCfg(activeName()).skills || [] });
}
// Manual recursive copy — fs.cpSync segfaults on this OneDrive/Unicode path.
function copyDirSafe(src, dst, depth) {
  if (depth > 8) return;
  let entries;
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch (_) { return; }
  try { fs.mkdirSync(dst, { recursive: true }); } catch (_) {}
  for (const e of entries) {
    if (e.isSymbolicLink && e.isSymbolicLink()) continue; // skip symlinks
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDirSafe(s, d, depth + 1);
    else if (e.isFile()) { try { fs.copyFileSync(s, d); } catch (_) {} }
  }
}
function applySkills(name) {
  const enabled = projCfg(name).skills || [];
  const dest = path.join(PROJECTS_ROOT, name, ".claude", "skills");
  try { fs.rmSync(dest, { recursive: true, force: true }); } catch (_) {}
  for (const s of enabled) {
    const src = path.join(SKILLS_DIR, s);
    if (fs.existsSync(src)) copyDirSafe(src, path.join(dest, s), 0);
  }
}

// ---- project management ---------------------------------------------------
const STARTER = {
  "index.html": `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New project</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1 id="t">Hello, world.</h1>
    <p>Edit me via chat →</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
  "styles.css": `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
#t { font-size: 48px; }
`,
  "app.js": `console.log("project ready");
`
};

function activeName() { return path.basename(WORKDIR); }

function listProjects() {
  try {
    return fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
      .map((d) => {
        let mtime = 0;
        try { mtime = fs.statSync(path.join(PROJECTS_ROOT, d.name)).mtimeMs; } catch (_) {}
        return { name: d.name, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch (_) { return []; }
}

function sendProjects() { sendUI({ type: "projects", list: listProjects(), active: activeName(), root: PROJECTS_ROOT }); }

function ensureActive() {
  let list = listProjects();
  if (!list.length) {
    const dir = path.join(PROJECTS_ROOT, "untitled");
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    seedProject(dir);
    list = listProjects();
  }
  WORKDIR = path.join(PROJECTS_ROOT, list[0] ? list[0].name : "untitled");
}

function seedProject(dir) {
  for (const [name, content] of Object.entries(STARTER)) {
    const p = path.join(dir, name);
    try { if (!fs.existsSync(p)) fs.writeFileSync(p, content); } catch (_) {}
  }
}

function safeProjectName(name) {
  return String(name || "").trim().replace(/[^A-Za-z0-9._\- ]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "")
    || ("project-" + Date.now());
}

function switchTo(dir, activeProjectName) {
  WORKDIR = dir;
  sessionId = null;
  allowAlways.clear();
  if (activeChild) activeChild.kill("SIGTERM");
  writeClaudeMd();
  sendUI({ type: "workdir", workdir: WORKDIR });
  sendUI({ type: "session", sessionId: null });
  sendProjects();
  sendPrompts();
  pushFiles();
}

function createProject(name) {
  const safe = safeProjectName(name);
  const dir = path.join(PROJECTS_ROOT, safe);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { sendUI({ type: "error", message: e.message }); return; }
  seedProject(dir);
  switchTo(dir, safe);
}

function openProject(name) {
  const dir = path.join(PROJECTS_ROOT, path.basename(String(name || "")));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { sendUI({ type: "error", message: "No such project: " + name }); return; }
  switchTo(dir, path.basename(dir));
}

// ---- static file serving --------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json"
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(STATIC_ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(STATIC_ROOT)) { res.writeHead(403).end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

// ---- HTTP server (static + internal permission endpoint) ------------------
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/internal/permission") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch {}
      const decision = await requestPermission(payload.tool_name, payload.input);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(decision));
    });
    return;
  }
  serveStatic(req, res);
});

// ---- WebSocket to the browser ---------------------------------------------
const wss = new WebSocketServer({ server });
let ws = null;
function sendUI(obj) { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); }

wss.on("connection", (socket) => {
  ws = socket;
  sendUI({ type: "ready", workdir: WORKDIR, model: MODEL || "default", sessionId });
  sendProjects();
  sendPrompts();
  pushFiles(); // mirror whatever is already on disk

  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    switch (msg.type) {
      case "prompt": runTurn(msg.text); break;
      case "permission_response": resolvePermission(msg.id, msg.decision); break;
      case "stop": if (activeChild) activeChild.kill("SIGTERM"); break;
      case "new_session":
        sessionId = null; allowAlways.clear();
        if (activeChild) activeChild.kill("SIGTERM");
        sendUI({ type: "session", sessionId: null });
        break;
      case "set_model":
        MODEL = msg.model || "";
        sendUI({ type: "model", model: MODEL || "default" });
        break;
      case "set_workdir": setWorkdir(msg.path); break;
      case "list_projects": sendProjects(); break;
      case "create_project": createProject(msg.name); break;
      case "open_project": openProject(msg.name); break;
      case "get_prompts": sendPrompts(); break;
      case "set_prompts":
        CONFIG.app = msg.app || "";
        CONFIG.global = msg.global || "";
        projCfg(activeName()).prompt = msg.project || "";
        saveConfig();
        writeClaudeMd();
        sendPrompts();
        break;
      case "list_skills": sendSkills(); break;
      case "set_skills":
        projCfg(activeName()).skills = Array.isArray(msg.names) ? msg.names : [];
        saveConfig();
        applySkills(activeName());
        writeClaudeMd();
        sendSkills();
        break;
      case "set_custom":
        CUSTOM = msg.text || "";
        if (msg.language) LANG = msg.language;
        if (msg.target) TARGET = msg.target;
        writeClaudeMd();
        break;
    }
  });

  socket.on("close", () => { if (ws === socket) ws = null; });
});

// ---- switch the working project (from the UI) -----------------------------
function setWorkdir(p) {
  if (!p || typeof p !== "string") { sendUI({ type: "error", message: "No project path provided." }); return; }
  const resolved = path.resolve(p);
  try {
    const st = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
    if (st && !st.isDirectory()) { sendUI({ type: "error", message: `Not a directory: ${resolved}` }); return; }
    if (!st) fs.mkdirSync(resolved, { recursive: true });
  } catch (err) { sendUI({ type: "error", message: `Cannot use directory: ${err.message}` }); return; }
  WORKDIR = resolved;
  sessionId = null;
  allowAlways.clear();
  if (activeChild) activeChild.kill("SIGTERM");
  writeClaudeMd();
  sendUI({ type: "workdir", workdir: WORKDIR });
  sendUI({ type: "session", sessionId: null });
  pushFiles();
}

// ---- permission bridge ----------------------------------------------------
function requestPermission(toolName, input) {
  return new Promise((resolve) => {
    if (allowAlways.has(toolName)) { resolve({ behavior: "allow", updatedInput: input }); return; }
    const id = randomUUID();
    const timer = setTimeout(() => {
      if (pendingPermissions.has(id)) {
        pendingPermissions.delete(id);
        resolve({ behavior: "deny", message: "Approval timed out (no response in 5 min)." });
        sendUI({ type: "permission_resolved", id, decision: "timeout" });
      }
    }, 5 * 60 * 1000);
    pendingPermissions.set(id, { resolve, timer, toolName, input });
    sendUI({ type: "permission_request", id, tool_name: toolName, input });
  });
}
function resolvePermission(id, decision) {
  const pending = pendingPermissions.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingPermissions.delete(id);
  if (decision === "allow" || decision === "allow_always") {
    if (decision === "allow_always") allowAlways.add(pending.toolName);
    pending.resolve({ behavior: "allow", updatedInput: pending.input });
  } else {
    pending.resolve({ behavior: "deny", message: "Denied by operator in the UI." });
  }
}

// Child env for the spawned `claude`. Drop host-managed auth that belongs to a
// parent Claude Code harness (it would 401 the standalone CLI); let the CLI use
// its own `claude` login, or an explicitly-set ANTHROPIC_API_KEY (kept as-is).
function childEnv() {
  const e = { ...process.env };
  for (const k of [
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH",
    "CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH",
    "CLAUDE_CODE_OAUTH_SCOPES",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_EXECPATH",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDECODE"
  ]) delete e[k];
  return e;
}

// ---- run one conversational turn ------------------------------------------
function runTurn(text) {
  if (!text || activeChild) return;
  const args = [
    "-p", text,
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-prompt-tool", "mcp__approval__approve",
    "--mcp-config", MCP_CONFIG_PATH
  ];
  if (sessionId) args.push("--resume", sessionId);
  if (MODEL) args.push("--model", MODEL);

  let child;
  try {
    // stdin: "ignore" so the CLI sees EOF immediately and runs the -p prompt
    // (otherwise it waits on stdin and warns "no stdin data received").
    child = spawn("claude", args, { cwd: WORKDIR, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
  }
  catch (err) { sendUI({ type: "error", message: `Failed to start claude: ${err.message}` }); return; }
  activeChild = child;
  sendUI({ type: "turn_start" });

  let outBuf = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    outBuf += chunk;
    let nl;
    while ((nl = outBuf.indexOf("\n")) !== -1) {
      const line = outBuf.slice(0, nl).trim();
      outBuf = outBuf.slice(nl + 1);
      if (line) handleEvent(line);
    }
  });

  let errBuf = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (c) => (errBuf += c));

  child.on("error", (err) => {
    sendUI({
      type: "error",
      message: err.code === "ENOENT"
        ? "`claude` was not found on PATH. Install Claude Code and log in (or set ANTHROPIC_API_KEY)."
        : `claude error: ${err.message}`
    });
    activeChild = null;
    sendUI({ type: "turn_end" });
  });

  child.on("close", (code) => {
    activeChild = null;
    if (code !== 0 && errBuf.trim()) sendUI({ type: "error", message: errBuf.trim().slice(0, 2000) });
    pushFiles();                 // authoritative snapshot after the turn
    sendUI({ type: "turn_end" });
  });
}

// ---- translate stream-json events into UI messages ------------------------
function handleEvent(line) {
  let ev;
  try { ev = JSON.parse(line); } catch { return; }

  if (ev.type === "system" && ev.subtype === "init") {
    if (ev.session_id) {
      sessionId = ev.session_id;
      sendUI({ type: "session", sessionId, model: ev.model, tools: ev.tools, mcp_servers: ev.mcp_servers });
    }
    return;
  }

  if (ev.type === "system" && ev.subtype === "api_retry") {
    sendUI({ type: "notice", text: `Retrying (${ev.attempt}/${ev.max_retries}) in ${Math.round((ev.retry_delay_ms || 0) / 1000)}s — ${ev.error}` });
    return;
  }

  if (ev.type === "stream_event" && ev.event) {
    const e = ev.event;
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
      sendUI({ type: "assistant_delta", text: e.delta.text });
    }
    return;
  }

  if (ev.type === "assistant" && ev.message?.content) {
    const blocks = [];
    for (const b of ev.message.content) {
      if (b.type === "text") blocks.push({ kind: "text", text: b.text });
      else if (b.type === "tool_use") {
        if (b.id) toolNames.set(b.id, b.name);   // remember for the result
        blocks.push({ kind: "tool_use", id: b.id, name: b.name, input: b.input });
      }
    }
    sendUI({ type: "assistant_message", blocks });
    return;
  }

  if (ev.type === "user" && ev.message?.content) {
    let edited = false;
    for (const b of ev.message.content) {
      if (b.type === "tool_result") {
        sendUI({
          type: "tool_result",
          tool_use_id: b.tool_use_id,
          is_error: !!b.is_error,
          content: stringifyContent(b.content)
        });
        if (!b.is_error && EDIT_TOOLS.has(toolNames.get(b.tool_use_id))) edited = true;
      }
    }
    if (edited) pushFiles();     // refresh preview/code right after a file edit
    return;
  }

  if (ev.type === "result") {
    sendUI({ type: "result", cost: ev.total_cost_usd, duration_ms: ev.duration_ms, is_error: ev.is_error, subtype: ev.subtype });
    return;
  }
}

function stringifyContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === "string" ? c : c.text || JSON.stringify(c))).join("\n");
  return content == null ? "" : JSON.stringify(content);
}

// ---- go -------------------------------------------------------------------
ensureActive();
writeClaudeMd();
server.listen(PORT, () => {
  console.log(`\n  Workbench (Claude Code engine)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  static:  ${STATIC_ROOT}`);
  console.log(`  workdir: ${WORKDIR}`);
  console.log(`  model:   ${MODEL || "account default"}`);
  console.log(`  auth:    ${process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "subscription / prior `claude` login"}\n`);
});
