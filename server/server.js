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
let WORKDIR = process.env.CLAUDE_UI_CWD
  ? path.resolve(process.env.CLAUDE_UI_CWD)
  : process.cwd();
let MODEL = process.env.CLAUDE_UI_MODEL || "";

// Workbench's preview inlines exactly these three files (see buildSrcDoc).
const PREVIEW_FILES = ["index.html", "styles.css", "app.js"];

// Layered-prompt inputs mirrored from the UI; written into <WORKDIR>/CLAUDE.md.
let CUSTOM = "";
let LANG = "ja";
let TARGET = "pc";

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

// ---- CLAUDE.md (layered prompt) -------------------------------------------
function writeClaudeMd() {
  const lang = LANG === "ja" ? "日本語" : "English";
  const target = TARGET === "mobile"
    ? "Mobile (portrait, ~390px). Mobile-first, large touch targets."
    : "Desktop. Wider grids and hover states.";
  const body = `# Workbench project — agent instructions

This is a single-page web app previewed live. Keep the project as exactly three
files at the project root and edit them in place:

- index.html  — must link styles.css via <link rel="stylesheet" href="styles.css">
                and app.js via <script src="app.js"></script>
- styles.css
- app.js

Do not add a build step, frameworks, or extra files unless explicitly asked.
Explain your work in ${lang}. Target form factor: ${target}
${CUSTOM ? `\n## Additional rules from the user\n${CUSTOM}\n` : ""}`;
  try { fs.writeFileSync(path.join(WORKDIR, "CLAUDE.md"), body); } catch (_) {}
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
writeClaudeMd();
server.listen(PORT, () => {
  console.log(`\n  Workbench (Claude Code engine)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  static:  ${STATIC_ROOT}`);
  console.log(`  workdir: ${WORKDIR}`);
  console.log(`  model:   ${MODEL || "account default"}`);
  console.log(`  auth:    ${process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "subscription / prior `claude` login"}\n`);
});
