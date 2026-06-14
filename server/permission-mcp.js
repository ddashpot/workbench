#!/usr/bin/env node
// permission-mcp.js
//
// A minimal MCP stdio server exposing a single tool, `approve`, that Claude Code
// calls (via `--permission-prompt-tool mcp__approval__approve`) whenever a tool
// use needs a permission decision.
//
// It does not decide anything itself: it forwards the request over HTTP to the
// main UI server, which asks the human in the browser, then returns the verdict.
//
// MCP stdio transport = newline-delimited JSON-RPC 2.0 messages on stdin/stdout.
// We implement just enough of it: initialize, tools/list, tools/call.

const UI_PORT = process.env.UI_SERVER_PORT || "4317";
const PERMISSION_URL = `http://127.0.0.1:${UI_PORT}/internal/permission`;

// ---- stdout framing -------------------------------------------------------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// ---- the approve tool -----------------------------------------------------
const APPROVE_TOOL = {
  name: "approve",
  description:
    "Permission gate. Claude Code calls this before running a tool that needs " +
    "approval. Returns an allow/deny decision from the human operator.",
  inputSchema: {
    type: "object",
    properties: {
      tool_name: { type: "string", description: "Name of the tool being requested." },
      input: { type: "object", description: "Proposed input for that tool." }
    },
    additionalProperties: true
  }
};

// The CLI passes the requested tool's name + input. Key names have shifted across
// versions, so read defensively.
function extractRequest(args = {}) {
  const tool_name =
    args.tool_name || args.toolName || args.tool || args.name || "unknown_tool";
  const input =
    args.input !== undefined ? args.input
    : args.tool_input !== undefined ? args.tool_input
    : args.arguments !== undefined ? args.arguments
    : {};
  return { tool_name, input };
}

async function askHuman(tool_name, input) {
  try {
    const res = await fetch(PERMISSION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool_name, input })
    });
    if (!res.ok) {
      return { behavior: "deny", message: `UI server returned HTTP ${res.status}.` };
    }
    return await res.json(); // { behavior: "allow", updatedInput } | { behavior: "deny", message }
  } catch (err) {
    return { behavior: "deny", message: `Could not reach UI server: ${err.message}` };
  }
}

// ---- request dispatch -----------------------------------------------------
async function handle(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) need no response.
  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      reply(id, {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "approval", version: "0.1.0" }
      });
      return;

    case "tools/list":
      reply(id, { tools: [APPROVE_TOOL] });
      return;

    case "tools/call": {
      if (params?.name !== "approve") {
        replyError(id, -32602, `Unknown tool: ${params?.name}`);
        return;
      }
      const { tool_name, input } = extractRequest(params.arguments);
      const decision = await askHuman(tool_name, input);
      // The permission-prompt-tool contract: return the decision JSON as the
      // tool result's text content.
      reply(id, {
        content: [{ type: "text", text: JSON.stringify(decision) }]
      });
      return;
    }

    case "ping":
      reply(id, {});
      return;

    default:
      replyError(id, -32601, `Method not found: ${method}`);
  }
}

// ---- stdin line reader ----------------------------------------------------
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignore malformed lines
    }
    handle(msg).catch((err) => {
      if (msg && msg.id != null) replyError(msg.id, -32603, String(err));
    });
  }
});

process.stdin.on("end", () => process.exit(0));
