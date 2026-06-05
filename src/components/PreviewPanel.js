/* Preview panel: live iframe + code editor + console + device toggle + drag-select mode. */
const { useState: ppUseState, useRef: ppUseRef, useEffect: ppUseEffect, useMemo: ppUseMemo } = React;

window.PreviewPanel = function ({
  files, t, device, setDevice, view, setView, logs, clearLogs,
  iframeKey, onReload, onOpenExternal,
  selectMode, setSelectMode, overrides, setOverrides,
  selected, setSelected,
}) {
  const previewSrc = ppUseMemo(() => buildSrcDoc(files), [files]);
  const iframeRef = ppUseRef(null);

  // Send mode + overrides to iframe whenever they change
  ppUseEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ __wb_setMode: !!selectMode }, "*");
  }, [selectMode, iframeKey, files]);

  ppUseEffect(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ __wb_setOverrides: overrides || {} }, "*");
  }, [overrides, iframeKey, files]);

  function onIframeLoad() {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ __wb_setMode: !!selectMode }, "*");
    w.postMessage({ __wb_setOverrides: overrides || {} }, "*");
  }

  function resetSelected() {
    if (!selected) return;
    const next = { ...overrides };
    delete next[selected.id];
    setOverrides(next);
    iframeRef.current?.contentWindow?.postMessage(
      { __wb_resetOne: selected.id }, "*");
  }
  function resetAll() {
    setOverrides({});
    iframeRef.current?.contentWindow?.postMessage({ __wb_resetAll: true }, "*");
  }

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="pt-tabs">
          <button className={"pt-tab " + (view === "preview" ? "on" : "")} onClick={() => setView("preview")}>
            <span className="ico"><Icon name="eye" /></span>{t("preview")}
          </button>
          <button className={"pt-tab " + (view === "code" ? "on" : "")} onClick={() => setView("code")}>
            <span className="ico"><Icon name="code" /></span>{t("code")}
          </button>
          <button className={"pt-tab " + (view === "console" ? "on" : "")} onClick={() => setView("console")}>
            <span className="ico"><Icon name="bug" /></span>{t("console")}
            {logs.some((l) => l.kind === "error") && <span style={{ marginLeft: 6, padding: "0 5px", borderRadius: 8, background: "rgba(229,87,101,0.18)", color: "var(--danger)", fontSize: 10 }}>{logs.filter((l) => l.kind === "error").length}</span>}
          </button>
        </div>
        <span className="spacer" />
        {view === "preview" && (
          <>
            <button
              className={"pt-tool-btn " + (selectMode ? "on" : "")}
              onClick={() => setSelectMode(!selectMode)}
              title={t("select_mode")}
            >
              <Icon name="pointer" size={13} />
              <span className="lbl">{t("select_mode")}</span>
            </button>
            <div className="device-seg">
              <button className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")} title={t("desktop")}><Icon name="desktop" /></button>
              <button className={device === "tablet" ? "on" : ""} onClick={() => setDevice("tablet")} title={t("tablet")}><Icon name="tablet" /></button>
              <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")} title={t("mobile")}><Icon name="mobile" /></button>
            </div>
          </>
        )}
        <button className="pt-icon-btn" onClick={onReload} title={t("refresh")}><Icon name="refresh" /></button>
        <button className="pt-icon-btn" onClick={onOpenExternal} title={t("open_external")}><Icon name="expand" /></button>
      </div>

      {view === "preview" && (
        <div className={"preview-stage " + (selectMode ? "in-select" : "")}>
          <div className={"device-frame " + device}>
            <iframe
              ref={iframeRef}
              key={iframeKey}
              srcDoc={previewSrc}
              sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
              title="preview"
              onLoad={onIframeLoad}
            />
          </div>
          {selectMode && (
            <div className="select-chip">
              <span className="dot" />
              <span className="sc-title">{t("select_on")}</span>
              {selected ? (
                <>
                  <span className="sc-meta">
                    {selected.tag.toLowerCase()}
                    {selected.label ? ` · "${selected.label}"` : ""}
                  </span>
                  <span className="sc-coord">
                    x:{Math.round(overrides[selected.id]?.x || 0)}
                    {" "}y:{Math.round(overrides[selected.id]?.y || 0)}
                  </span>
                  <button onClick={resetSelected}>
                    <Icon name="refresh" size={11} />
                  </button>
                </>
              ) : (
                <span className="sc-meta">{t("nothing_selected")}</span>
              )}
              <span style={{ flex: 1 }} />
              {Object.keys(overrides || {}).length > 0 && (
                <button onClick={resetAll} className="sc-reset-all">{t("reset_positions")}</button>
              )}
            </div>
          )}
        </div>
      )}

      {view === "code" && <CodeEditor files={files} t={t} />}

      {view === "console" && <ConsolePane logs={logs} clearLogs={clearLogs} t={t} />}

      <div className="preview-bottom">
        <span className="meta-chip">{Object.keys(files).join(" · ")}</span>
        <span className="spacer" />
        <span>{Object.values(files).reduce((s, c) => s + c.length, 0).toLocaleString()} {t("chars")}</span>
      </div>
    </div>
  );
};

function buildSrcDoc(files) {
  const html = files["index.html"] || "<!DOCTYPE html><html><body><p style='padding:24px;color:#888;font-family:system-ui'>index.html is missing</p></body></html>";
  const css = files["styles.css"] || "";
  const js = files["app.js"] || "";

  const consoleBridge = `<script>
(function(){
  const send = (kind, args) => {
    try {
      const data = Array.from(args).map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "object") { try { return JSON.stringify(a); } catch(e){ return String(a); } }
        return String(a);
      }).join(" ");
      parent.postMessage({ __preview_console: true, kind, data, ts: Date.now() }, "*");
    } catch(e) {}
  };
  ["log","warn","error","info","debug"].forEach((k) => {
    const orig = console[k].bind(console);
    console[k] = function(){ send(k, arguments); orig.apply(console, arguments); };
  });
  window.addEventListener("error", (e) => send("error", [e.message + " (" + (e.filename||"") + ":" + e.lineno + ":" + e.colno + ")"]));
  window.addEventListener("unhandledrejection", (e) => send("error", ["Unhandled: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)]));
})();
</script>`;

  // Drag-select editor injected into iframe. Listens for postMessage from parent.
  const editor = `<style id="__wb_edit_css">
  body.__wb_edit *[data-wb-id]:hover { outline: 1px dashed #548af7 !important; outline-offset: 1px; cursor: move !important; }
  body.__wb_edit .__wb_selected { outline: 2px solid #548af7 !important; outline-offset: 2px; }
  body.__wb_edit { user-select: none !important; }
  body.__wb_edit input, body.__wb_edit textarea { pointer-events: none; }
</style>
<script>
(function(){
  let mode = false;
  let selected = null;
  let dragging = null;
  let overrides = {};

  function tagAll() {
    let i = 1;
    document.querySelectorAll('body, body *').forEach((el) => {
      if (!el.dataset.wbId) el.dataset.wbId = 'wb' + (i++);
    });
  }
  function applyAll() {
    Object.entries(overrides).forEach(([id, v]) => {
      const el = document.querySelector('[data-wb-id="' + id + '"]');
      if (el) el.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px)';
    });
  }
  function deselect() {
    if (selected) selected.classList.remove('__wb_selected');
    selected = null;
  }

  window.addEventListener('message', (e) => {
    const m = e.data || {};
    if ('__wb_setMode' in m) {
      mode = !!m.__wb_setMode;
      document.body.classList.toggle('__wb_edit', mode);
      tagAll();
      if (!mode) deselect();
    }
    if (m.__wb_setOverrides) {
      overrides = m.__wb_setOverrides;
      tagAll();
      applyAll();
    }
    if (m.__wb_resetOne) {
      const id = m.__wb_resetOne;
      delete overrides[id];
      const el = document.querySelector('[data-wb-id="' + id + '"]');
      if (el) el.style.transform = '';
    }
    if (m.__wb_resetAll) {
      Object.keys(overrides).forEach((id) => {
        const el = document.querySelector('[data-wb-id="' + id + '"]');
        if (el) el.style.transform = '';
      });
      overrides = {};
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!mode) return;
    if (e.target === document.body || e.target === document.documentElement) {
      deselect();
      parent.postMessage({ __wb_select: null }, '*');
      return;
    }
    e.preventDefault(); e.stopPropagation();
    deselect();
    selected = e.target;
    selected.classList.add('__wb_selected');
    const id = selected.dataset.wbId;
    const cur = overrides[id] || { x: 0, y: 0 };
    dragging = { id, startX: e.clientX, startY: e.clientY, baseX: cur.x, baseY: cur.y };
    parent.postMessage({
      __wb_select: id,
      tag: selected.tagName,
      label: (selected.textContent || '').trim().slice(0, 24),
    }, '*');
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const x = dragging.baseX + (e.clientX - dragging.startX);
    const y = dragging.baseY + (e.clientY - dragging.startY);
    selected.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    overrides[dragging.id] = { x, y };
    parent.postMessage({ __wb_drag_live: true, id: dragging.id, x, y }, '*');
  }, true);

  document.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    const o = overrides[dragging.id];
    parent.postMessage({ __wb_drag: true, id: dragging.id, x: o.x, y: o.y }, '*');
    dragging = null;
  }, true);

  document.addEventListener('click', (e) => {
    if (mode) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Tag everything when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tagAll);
  } else {
    tagAll();
  }
  // Re-tag a moment later in case the app builds DOM after load
  setTimeout(tagAll, 300);
})();
</script>`;

  // Replace <link rel=stylesheet href=styles.css> and <script src=app.js> with inlined versions
  let out = html;
  out = out.replace(/<link[^>]*href=["']styles\.css["'][^>]*>/i, `<style>\n${css}\n</style>`);
  out = out.replace(/<script[^>]*src=["']app\.js["'][^>]*><\/script>/i, `<script>\n${js}\n</script>`);
  if (out.match(/<head[^>]*>/i)) {
    out = out.replace(/<head[^>]*>/i, (m) => m + consoleBridge + editor);
  } else {
    out = consoleBridge + editor + out;
  }
  return out;
}
window.buildSrcDoc = buildSrcDoc;

function CodeEditor({ files, t }) {
  const names = Object.keys(files);
  const [active, setActive] = ppUseState(names[0] || "index.html");
  ppUseEffect(() => {
    if (!files[active] && names[0]) setActive(names[0]);
  }, [files]);

  const code = files[active] || "";
  const lang = active.endsWith(".html") ? "html" : active.endsWith(".css") ? "css" : "js";
  const lines = code.split("\n");

  return (
    <div className="code-editor">
      <div className="file-tabs">
        {names.map((n) => {
          const ln = n.endsWith(".html") ? "html" : n.endsWith(".css") ? "css" : "js";
          const c = { html: "#e34c26", css: "#264de4", js: "#f7df1e" }[ln];
          return (
            <button key={n} className={"ft " + (n === active ? "on" : "")} onClick={() => setActive(n)}>
              <span className="lang-dot" style={{ background: c }} />{n}
            </button>
          );
        })}
      </div>
      <div className="editor-body">
        <div className="gutter-nums">
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre className="code-area" dangerouslySetInnerHTML={{ __html: window.highlight(code, lang) }} />
      </div>
    </div>
  );
}

function ConsolePane({ logs, clearLogs, t }) {
  return (
    <div className="console-panel">
      <div className="c-head">
        <span>{t("console")}</span>
        <span className="badge">{logs.length}</span>
        <span className={"badge " + (logs.some((l) => l.kind === "error") ? "err" : "")}>
          {logs.filter((l) => l.kind === "error").length} errors
        </span>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={clearLogs} style={{ color: "var(--fg-muted)", fontSize: 11 }}>Clear</button>
      </div>
      <div className="c-log">
        {logs.length === 0 && <div className="c-empty">No output yet. Run interactions in the preview.</div>}
        {logs.map((l, i) => (
          <div key={i} className={"c-line " + l.kind}>
            <span className="ts">{new Date(l.ts).toLocaleTimeString()}</span>
            <span className="msg">{l.data}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CodeEditor, ConsolePane });
