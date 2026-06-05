/* Multi-model wrapper.
   In this environment only Claude is reachable via window.claude.complete.
   Gemini / GPT entries are exposed in the UI and routed through Claude with
   a model-specific persona so the user can still pick per message. They're
   marked "(demo)" in the picker.
*/
window.MODELS = [
  { id: "claude-sonnet",  label: "Claude Sonnet 4.5", short: "Sonnet",  color: "#d97757",
    persona: "You are Claude (Sonnet 4.5). Be thoughtful and precise. Prefer clean, idiomatic code.",
    real: true, family: "claude" },
  { id: "claude-haiku",   label: "Claude Haiku 4.5", short: "Haiku",   color: "#d97757",
    persona: "You are Claude (Haiku 4.5). Be quick and concise.",
    real: true, family: "claude" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (demo)", short: "Gemini", color: "#4285f4",
    persona: "Respond in the style of Gemini: structured, with clear bullet structure when helpful.",
    real: false, family: "gemini" },
  { id: "gpt-4o",         label: "GPT-4o (demo)",   short: "GPT-4o",  color: "#10a37f",
    persona: "Respond in the style of GPT-4o: warm, conversational, code-first.",
    real: false, family: "gpt" },
];

window.modelById = (id) => window.MODELS.find((m) => m.id === id) || window.MODELS[0];

/* System prompt that teaches the model to return code in our convention. */
window.MODES = [
  { id: "plan",  label_ja: "プラン",  label_en: "Plan",  color: "#9876aa", icon: "sparkle" },
  { id: "ui",    label_ja: "画面",    label_en: "Screen", color: "#67a7e3", icon: "eye" },
  { id: "logic", label_ja: "ロジック", label_en: "Logic",  color: "#cf8e6d", icon: "code" },
  { id: "debug", label_ja: "デバッグ", label_en: "Debug",  color: "#e55765", icon: "bug" },
];
window.modeById = (id) => window.MODES.find((m) => m.id === id) || window.MODES[0];

window.buildSystemPrompt = function ({ mode, files, custom, persona, language, target, logs }) {
  const lang = language === "ja" ? "日本語" : "English";
  const fileList = Object.keys(files).join(", ");
  const fileSnippets = Object.entries(files)
    .map(([n, c]) => `--- ${n} ---\n${c}`)
    .join("\n\n");

  const modeLine = {
    plan:  "This is a PLANNING conversation. Do NOT emit code. Discuss requirements, propose structure, list features, sketch user flow. Keep it concise (bullet lists are fine). When the plan is clear, suggest the user switch to Screen or Logic mode to implement.",
    ui:    "Focus on UI: HTML structure and CSS styling. Only touch JS when behavior is needed.",
    logic: "Focus on JavaScript: state, data flow, event handling, side effects. Avoid changing visual styling unless asked.",
    debug: "This is a DEBUGGING conversation. Inspect the current console output and the code; identify the root cause; propose a minimal fix. If you change code, emit only the file(s) that need fixing.",
  }[mode] || "Help with the project as needed.";

  const targetLine = target === "mobile"
    ? "The target form factor is MOBILE (portrait, ~390px wide). Use mobile-first layouts: large touch targets (min 44px), bottom-anchored CTAs, single-column flows, native-feeling typography. Avoid hover-only affordances."
    : "The target form factor is DESKTOP. Use wider grids, hover states, and keyboard affordances. Don't sacrifice density for mobile-only conventions.";

  const logsLine = (mode === "debug" && logs && logs.length)
    ? "\n\nRecent console output (newest last):\n" + logs.slice(-30).map((l) => `[${l.kind}] ${l.data}`).join("\n")
    : "";

  return `${persona}

You are pair-programming inside a live HTML/CSS/JS sandbox.
The project currently has these files: ${fileList}.
Respond in ${lang}.

${modeLine}

${targetLine}${logsLine}

When you change code, emit ONLY the files that change, each as a fenced block tagged with the filename like:

\`\`\`html:index.html
<!-- full new contents -->
\`\`\`

\`\`\`css:styles.css
/* full new contents */
\`\`\`

\`\`\`js:app.js
// full new contents
\`\`\`

Always emit the FULL new file contents, not a diff. Brief explanations before/after are welcome, but be concise.

${custom ? `Additional rules from the user:\n${custom}` : ""}

Current project state:

${fileSnippets}`;
};

/* Chunked streaming. claude.complete returns a final string; we fake streaming
   by yielding ~24-char slices. Slows long outputs slightly but feels alive. */
window.streamComplete = async function ({ systemPrompt, messages, onChunk, signal }) {
  // Build a single prompt — claude.complete here accepts a messages array.
  const all = [{ role: "user", content: systemPrompt + "\n\n---\n\n" + flatten(messages) }];

  let result;
  try {
    result = await window.claude.complete({ messages: all });
  } catch (e) {
    throw e;
  }
  if (typeof result !== "string") result = String(result);

  // Fake stream
  const chunkSize = 18;
  let i = 0;
  while (i < result.length) {
    if (signal && signal.aborted) return;
    const next = result.slice(i, i + chunkSize);
    onChunk(next);
    i += chunkSize;
    await new Promise((r) => setTimeout(r, 14));
  }
  return result;
};

function flatten(messages) {
  return messages
    .map((m) => {
      if (m.role === "user")    return `User: ${m.content}`;
      if (m.role === "assistant") return `Assistant: ${m.content}`;
      return m.content;
    })
    .join("\n\n");
}

/* Parser: extract code blocks tagged like ```html:index.html ... ``` */
window.parseCodeBlocks = function (text) {
  const out = [];
  const re = /```(\w+)(?::([\w./-]+))?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text))) {
    const [, lang, fname, code] = m;
    out.push({
      lang,
      filename: fname || defaultFile(lang),
      code: code.trimEnd(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
};

function defaultFile(lang) {
  return {
    html: "index.html",
    css: "styles.css",
    js: "app.js",
    javascript: "app.js",
  }[lang.toLowerCase()] || `snippet.${lang}`;
}

/* Render text with code blocks split out for the UI */
window.splitMessageParts = function (text) {
  const blocks = window.parseCodeBlocks(text);
  if (!blocks.length) return [{ kind: "text", text }];
  const parts = [];
  let cursor = 0;
  for (const b of blocks) {
    if (b.start > cursor) {
      const t = text.slice(cursor, b.start).trim();
      if (t) parts.push({ kind: "text", text: t });
    }
    parts.push({ kind: "code", ...b });
    cursor = b.end;
  }
  if (cursor < text.length) {
    const t = text.slice(cursor).trim();
    if (t) parts.push({ kind: "text", text: t });
  }
  return parts;
};
