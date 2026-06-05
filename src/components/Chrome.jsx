/* History / branches popover panel. */
window.HistoryPanel = function ({ t, project, onSelect, onClose, onRenameVersion }) {
  if (!project) return null;
  const versions = project.versions || [];
  return (
    <div className="history-panel" onClick={(e) => e.stopPropagation()}>
      <div className="hp-head">
        <span className="hp-title">{t("history")}</span>
        <button onClick={onClose} className="pt-icon-btn"><Icon name="close" size={12} /></button>
      </div>
      <div className="hp-list">
        {versions.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: "var(--fg-dim)" }}>
            {t("untitled")}{" — "}{t("status_ready")}
          </div>
        )}
        {[...versions].reverse().map((v) => (
          <div
            key={v.id}
            className={"hp-item " + (v.id === project.currentVersionId ? "on" : "")}
            onClick={() => onSelect(v.id)}
            onDoubleClick={() => {
              if (!onRenameVersion) return;
              const next = prompt(t("rename"), v.label);
              if (next) onRenameVersion(v.id, next);
            }}
            title={t("revert")}
          >
            <span className="branch-dot" />
            <div>
              <div className="nm">{v.label}</div>
              <div className="desc">{v.note}</div>
            </div>
            <span className="hp-revert">{t("revert")}</span>
            <span className="ts">{new Date(v.ts).toLocaleTimeString().slice(0, 5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

window.ComponentsPanel = function ({ t, onInsert, onClose }) {
  return (
    <div className="history-panel" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
      <div className="hp-head">
        <span className="hp-title">{t("component_lib")}</span>
        <button onClick={onClose} className="pt-icon-btn"><Icon name="close" size={12} /></button>
      </div>
      <div className="hp-list" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {window.COMPONENT_LIB.map((c, i) => (
          <div key={i} style={{
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 6, padding: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--fg-strong)", fontWeight: 500 }}>{c.name}</span>
              <span style={{ marginLeft: "auto" }} />
              <button
                onClick={() => onInsert(c)}
                style={{
                  height: 22, padding: "0 8px", background: "var(--accent)", color: "#fff",
                  borderRadius: 3, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <Icon name="plus" size={10} />{t("insert_comp")}
              </button>
            </div>
            <div style={{
              background: "#fff", borderRadius: 4, padding: 12,
              display: "grid", placeItems: "center", minHeight: 60,
            }} dangerouslySetInnerHTML={{ __html: c.code }} />
          </div>
        ))}
      </div>
    </div>
  );
};

/* Top bar. */
window.TopBar = function ({ t, language, setLanguage, projectName, onRun, onExport, onShare, onDeploy, busy, onShowGallery, target, setTarget }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <span>{t("brand")}</span>
      </div>
      <div className="breadcrumb">
        <span className="sep">/</span>
        <span>{t("project")}</span>
        <span className="sep">/</span>
        <span className="current">{projectName || t("untitled")}</span>
      </div>
      <span className="spacer" />
      {setTarget && (
        <div className="target-seg" title={t("target")}>
          <button className={target === "pc" ? "on" : ""} onClick={() => setTarget("pc")}>
            <Icon name="desktop" />{t("target_pc")}
          </button>
          <button className={target === "mobile" ? "on" : ""} onClick={() => setTarget("mobile")}>
            <Icon name="mobile" />{t("target_mobile")}
          </button>
        </div>
      )}
      <div className="seg">
        <button className={language === "ja" ? "on" : ""} onClick={() => setLanguage("ja")}>JA</button>
        <button className={language === "en" ? "on" : ""} onClick={() => setLanguage("en")}>EN</button>
      </div>
      <button className="tb-btn" onClick={onShowGallery} title={t("templates")}>
        <Icon name="template" size={13} />
      </button>
      <button className="tb-btn ghost" onClick={onShare} title={t("share")}>
        <Icon name="share" size={13} /><span className="lbl">{t("share")}</span>
      </button>
      <button className="tb-btn ghost" onClick={onExport} title={t("export")}>
        <Icon name="download" size={13} /><span className="lbl">{t("export")}</span>
      </button>
      {onDeploy && (
        <button className="tb-btn ghost" onClick={onDeploy} title={t("deploy")}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/>
          </svg>
          <span className="lbl">{t("deploy")}</span>
        </button>
      )}
      <button className="tb-btn primary" onClick={onRun}>
        <Icon name={busy ? "stop" : "play"} size={12} />
        {busy ? t("stop") : t("run")}
      </button>
    </div>
  );
};

/* Status bar. */
window.StatusBar = function ({ t, model, status, busy, files }) {
  const m = window.modelById(model);
  const fileCount = Object.keys(files).length;
  const totalChars = Object.values(files).reduce((s, c) => s + c.length, 0);
  return (
    <div className="statusbar">
      <span className={"sb-item " + (busy ? "" : "live")}>
        <span className="dot" />
        {busy ? t("status_generating") : t("status_ready")}
      </span>
      <span className="sb-item">
        <span className="swatch" style={{ width: 7, height: 7, borderRadius: "50%", background: m.color }} />
        {m.label}
      </span>
      <span className="sb-item">
        <Icon name="folder" size={11} /> {fileCount} files · {totalChars.toLocaleString()} chars
      </span>
      <span className="spacer" />
      <span className="sb-item">UTF-8</span>
      <span className="sb-item">{t("main_branch")}</span>
    </div>
  );
};
