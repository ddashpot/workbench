/* Message component + composer. Globals: React, Icon, highlight, splitMessageParts, MODELS, modelById. */
const { useState, useRef, useEffect, useMemo } = React;

function ModelDot({ color }) {
  return <span className="swatch" style={{ background: color }} />;
}

window.ModelPicker = function ({ value, onChange, t, anchor = "bottom" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = window.modelById(value);
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <div className="model-picker" ref={ref} onClick={() => setOpen((o) => !o)}>
      <ModelDot color={cur.color} />
      <span>{cur.short}</span>
      <svg className="chev" width="10" height="10" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
      {open && (
        <div className="menu" style={anchor === "top" ? { top: "calc(100% + 4px)", bottom: "auto" } : null}>
          <div className="mh">Models</div>
          {window.MODELS.map((m) => (
            <button
              key={m.id}
              className={"mi " + (m.id === value ? "on" : "")}
              onClick={(e) => { e.stopPropagation(); onChange(m.id); setOpen(false); }}
            >
              <ModelDot color={m.color} />
              <span className="mi-name">{m.label}</span>
              <span className="mi-meta">{m.real ? "live" : "demo"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

window.ModePicker = function ({ value, onChange, t, language }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = window.modeById(value);
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const label = (m) => language === "ja" ? m.label_ja : m.label_en;
  return (
    <div className="mode-picker" ref={ref} onClick={() => setOpen((o) => !o)}>
      <span className="mp-dot" style={{ background: cur.color }} />
      <span>{label(cur)}</span>
      <svg className="chev" width="10" height="10" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
      {open && (
        <div className="menu">
          <div className="mh">{language === "ja" ? "モード" : "Mode"}</div>
          {window.MODES.map((m) => (
            <button
              key={m.id}
              className={"mi mode-mi " + (m.id === value ? "on" : "")}
              onClick={(e) => { e.stopPropagation(); onChange(m.id); setOpen(false); }}
            >
              <span className="mp-dot" style={{ background: m.color }} />
              <span className="mi-name">{label(m)}</span>
              <span className="mi-meta mi-hint">{t("mode_" + m.id + "_hint")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function CodeBlock({ block, files, onApply, applied, t }) {
  const [diff, setDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const langDotColor = { html: "#e34c26", css: "#264de4", js: "#f7df1e", javascript: "#f7df1e" }[block.lang] || "#6b7280";
  const existing = files[block.filename] || "";
  const stats = useMemo(() => quickDiffStats(existing, block.code), [existing, block.code]);

  function doCopy() {
    navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="code-block">
      <div className="cb-head">
        <span className="lang"><span className="lang-dot" style={{ background: langDotColor }} />{block.filename}</span>
        {existing && (
          <span className="changes">
            <span className="plus">+{stats.add}</span>{" "}
            <span className="minus">−{stats.del}</span>
          </span>
        )}
        <div className="cb-actions">
          {existing && (
            <button onClick={() => setDiff((d) => !d)}>
              {diff ? t("full_view") : t("diff_view")}
            </button>
          )}
          <button onClick={doCopy}>
            <Icon name="copy" size={11} />
            {copied ? t("copied") : t("copy")}
          </button>
          <button className="apply" onClick={onApply} disabled={applied}>
            {applied ? <><Icon name="check" size={11} />{t("applied")}</> : <><Icon name="play" size={11} />{t("apply")}</>}
          </button>
        </div>
      </div>
      {diff ? <DiffPre old={existing} next={block.code} /> : (
        <pre dangerouslySetInnerHTML={{ __html: window.highlight(block.code, block.lang) }} />
      )}
    </div>
  );
}

function DiffPre({ old, next }) {
  const lines = useMemo(() => simpleDiff(old.split("\n"), next.split("\n")), [old, next]);
  return (
    <pre>
      {lines.map((l, i) => (
        <span key={i} className={"diff-line " + l.kind}>{l.text || " "}</span>
      ))}
    </pre>
  );
}

function quickDiffStats(a, b) {
  if (!a) return { add: b.split("\n").length, del: 0 };
  const aLines = new Set(a.split("\n"));
  const bLines = new Set(b.split("\n"));
  let add = 0, del = 0;
  for (const ln of b.split("\n")) if (!aLines.has(ln)) add++;
  for (const ln of a.split("\n")) if (!bLines.has(ln)) del++;
  return { add, del };
}

function simpleDiff(a, b) {
  // LCS-based line diff (small inputs only)
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ kind: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: "del", text: a[i] }); i++; }
    else { out.push({ kind: "add", text: b[j] }); j++; }
  }
  while (i < m) { out.push({ kind: "del", text: a[i++] }); }
  while (j < n) { out.push({ kind: "add", text: b[j++] }); }
  return out;
}

window.Message = function ({ msg, files, onApplyBlock, onEdit, onRegen, onBranch, t, language }) {
  const m = window.modelById(msg.model);
  const mode = window.modeById(msg.mode || "ui");
  const isAssistant = msg.role === "assistant";
  const parts = useMemo(() => window.splitMessageParts(msg.content || ""), [msg.content]);
  const cls = isAssistant ? m.family : "user";

  return (
    <div className={"msg " + cls}>
      <div className="avatar">{isAssistant ? m.short[0] : "Y"}</div>
      <div className="body">
        <div className="meta">
          <span className="who">{isAssistant ? m.label : t("project") === "Project" ? "You" : "あなた"}</span>
          <span className="mode-pill" style={{ "--mode-color": mode.color }}>
            <span className="mp-dot" style={{ background: mode.color }} />
            {language === "ja" ? mode.label_ja : mode.label_en}
          </span>
          {isAssistant && (
            <span className="model-pill">
              <span className="swatch" style={{ background: m.color }} />
              {m.real ? "live" : "demo"}
            </span>
          )}
          <span className="ts">{formatTs(msg.ts)}</span>
        </div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="attachments">
            {msg.attachments.map((a, i) => (
              <span className="att" key={i}>
                <span className="x"><Icon name="image" size={12} /></span>{a.name}
              </span>
            ))}
          </div>
        )}
        <div className={"content " + (msg.streaming ? "streaming" : "")}>
          {parts.map((p, i) => p.kind === "text" ? (
            <p key={i} dangerouslySetInnerHTML={{ __html: markdownLite(p.text) }} />
          ) : (
            <CodeBlock key={i} block={p} files={files} t={t}
              onApply={() => onApplyBlock(p)}
              applied={msg.appliedBlocks && msg.appliedBlocks[p.filename] === p.code}
            />
          ))}
          {msg.streaming && parts.length === 0 && (
            <p style={{ color: "var(--fg-muted)" }}>{t("streaming")}</p>
          )}
        </div>
        {isAssistant && !msg.streaming && (
          <div className="actions">
            <button onClick={onRegen}><Icon name="refresh" size={11} />{t("regenerate")}</button>
            <button onClick={onBranch}><Icon name="branch" size={11} />{t("branch_here")}</button>
          </div>
        )}
        {!isAssistant && (
          <div className="actions">
            <button onClick={onEdit}><Icon name="edit" size={11} />{t("edit")}</button>
            <button onClick={onBranch}><Icon name="branch" size={11} />{t("branch_here")}</button>
          </div>
        )}
      </div>
    </div>
  );
};

function formatTs(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function markdownLite(t) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

window.Composer = function ({
  value, setValue, onSend, model, setModel, mode, setMode, t, language, busy, onStop,
  attachments, setAttachments, quickPrompts, onQuickPrompt,
}) {
  const taRef = useRef(null);
  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  }
  function onPaste(e) {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setAttachments([...attachments, { name: file.name || "pasted.png", url, type: file.type }]);
        }
      }
    }
  }
  function pickFile() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files?.[0]; if (!f) return;
      const url = URL.createObjectURL(f);
      setAttachments([...attachments, { name: f.name, url, type: f.type }]);
    };
    inp.click();
  }

  useEffect(() => { taRef.current?.focus(); }, []);

  const curMode = window.modeById(mode);
  const placeholder = {
    plan: language === "ja" ? "作りたいものを話して下さい…" : "Describe what to build…",
    ui: t("placeholder_ui"),
    logic: t("placeholder_logic"),
    debug: language === "ja" ? "エラーや期待と違う動作を伝えてください…" : "Describe the bug or unexpected behavior…",
  }[mode] || t("placeholder_ui");

  return (
    <div className="composer" onPaste={onPaste}>
      {quickPrompts && quickPrompts.length > 0 && (
        <div className="composer-attach-row" style={{ marginBottom: 8 }}>
          {quickPrompts.map((q) => (
            <button key={q.label} className="pill" onClick={() => onQuickPrompt(q.text)}>
              <Icon name="sparkle" size={10} />{q.label}
            </button>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="composer-attach-row">
          {attachments.map((a, i) => (
            <span className="pill" key={i}>
              <Icon name="image" size={12} />{a.name}
              <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} aria-label="remove">
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-box" style={{ "--mode-color": curMode.color }}>
        <textarea
          ref={taRef}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="composer-bottom">
          <button className="icon-btn" onClick={pickFile} title={t("drag_image")}>
            <Icon name="paperclip" />
          </button>
          <window.ModelPicker value={model} onChange={setModel} t={t} />
          <window.ModePicker value={mode} onChange={setMode} t={t} language={language} />
          <span className="spacer" />
          {busy ? (
            <button className="send-btn" onClick={onStop} style={{ background: "var(--danger)" }}>
              <Icon name="stop" size={11} />{t("stop")}
            </button>
          ) : (
            <button className="send-btn" onClick={onSend} disabled={!value.trim() && attachments.length === 0}>
              <Icon name="send" size={11} />
              {t("status_ready") === "Ready" ? "Send" : "送信"}
              <span className="shortcut">⏎</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CodeBlock, simpleDiff, quickDiffStats });
