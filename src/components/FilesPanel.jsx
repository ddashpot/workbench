/* FilesPanel: Local / GitHub / Google Drive tabs. */
const { useState: fpUseState } = React;

window.FilesPanel = function ({ t, language, project, onImportFiles, onOpenLocal, onConnectGitHub, onClose }) {
  const [tab, setTab] = fpUseState("local");
  const ghSession = window.useGitHubAuth();
  const [gdConnected, setGdConnected] = fpUseState(() => localStorage.getItem("wb.gdrive") === "1");
  const [activeRepo, setActiveRepo] = fpUseState(null);

  function disconnectGH() { window.GitHubAuth.clear(); setActiveRepo(null); }
  function connectGD() { localStorage.setItem("wb.gdrive", "1"); setGdConnected(true); }
  function disconnectGD() { localStorage.setItem("wb.gdrive", "0"); setGdConnected(false); }

  function importRepo(repo) {
    const files = window.MOCK_GITHUB.files[repo.name];
    if (!files) return;
    const next = {};
    files.filter((f) => f.type === "file" && f.content).forEach((f) => { next[f.name] = f.content; });
    if (Object.keys(next).length === 0) return;
    onImportFiles(next, `GitHub: ${repo.name}`);
  }

  function importDriveAsset(file) {
    if (!file.asset) return;
    onImportFiles({ "styles.css": (project.files["styles.css"] || "") + "\n\n" + file.asset },
      `Drive: ${file.name}`);
  }

  return (
    <div className="files-panel" onClick={(e) => e.stopPropagation()}>
      <div className="hp-head">
        <span className="hp-title">{t("files")}</span>
        <button onClick={onClose} className="pt-icon-btn"><Icon name="close" size={12} /></button>
      </div>

      <div className="fp-tabs">
        <button className={tab === "local" ? "on" : ""} onClick={() => setTab("local")}>
          <Icon name="folder" size={12} />{t("local")}
        </button>
        <button className={tab === "github" ? "on" : ""} onClick={() => setTab("github")}>
          <GhIcon /> {t("github")}
        </button>
        <button className={tab === "gdrive" ? "on" : ""} onClick={() => setTab("gdrive")}>
          <GdIcon /> {t("gdrive")}
        </button>
      </div>

      <div className="fp-body">
        {tab === "local" && <LocalFiles project={project} onOpenLocal={onOpenLocal} t={t} />}
        {tab === "github" && (
          ghSession
            ? <GhFiles t={t} session={ghSession} activeRepo={activeRepo} setActiveRepo={setActiveRepo}
                onImportRepo={importRepo} onDisconnect={disconnectGH} />
            : <ConnectScreen t={t} kind="github" onConnect={onConnectGitHub} language={language} />
        )}
        {tab === "gdrive" && (
          gdConnected
            ? <GdFiles t={t} onImport={importDriveAsset} onDisconnect={disconnectGD} />
            : <ConnectScreen t={t} kind="gdrive" onConnect={connectGD} />
        )}
      </div>
    </div>
  );
};

function GhIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/></svg>;
}
function GdIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16"><path d="M6 1 L10 1 L15 9.5 L11 9.5 Z" fill="#fbbc04"/><path d="M11 9.5 L15 9.5 L13 13 L9 13 L7 9.5 L9 6 Z" fill="#4285f4"/><path d="M6 1 L9 6 L7 9.5 L5 13 L1 9.5 Z" fill="#34a853"/></svg>;
}

function LocalFiles({ project, t, onOpenLocal }) {
  const files = Object.entries(project?.files || {});
  return (
    <div className="fp-section">
      <div className="fp-section-head">{project?.name || t("project")}</div>
      <ul className="fp-list">
        {files.map(([name, content]) => {
          const ext = name.split(".").pop();
          const color = { html: "#e34c26", css: "#264de4", js: "#f7df1e" }[ext] || "#888";
          return (
            <li key={name} className="fp-row" onClick={() => onOpenLocal && onOpenLocal(name)}>
              <span className="fp-row-icon"><Icon name="code" size={12} /></span>
              <span className="fp-row-name">
                <span className="dot" style={{ background: color }} />
                {name}
              </span>
              <span className="fp-row-meta">{(content.length / 1024).toFixed(1)} KB</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConnectScreen({ t, kind, onConnect, language }) {
  const isGh = kind === "github";
  return (
    <div className="fp-connect">
      <div className="fp-connect-icon">
        {isGh ? <GhIcon /> : <GdIcon />}
      </div>
      <h4>{isGh ? t("github") : t("gdrive")}</h4>
      <p>
        {isGh
          ? (language === "ja"
              ? "OAuthでGitHubにサインインして、リポジトリを閲覧しファイルをインポートできます。"
              : "Sign in with GitHub via OAuth to browse repos and import files.")
          : (language === "ja"
              ? "Driveの素材をプロジェクトに取り込めます。"
              : "Bring design assets and snippets from Drive.")}
      </p>
      <button className="fp-btn primary" onClick={onConnect}>
        {isGh ? <GhIcon /> : <GdIcon />}
        {isGh
          ? (language === "ja" ? "GitHubでサインイン" : "Sign in with GitHub")
          : t("connect")}
      </button>
      <div className="fp-connect-meta">{isGh ? "OAuth (mock)" : "demo / mock auth"}</div>
    </div>
  );
}

function GhFiles({ t, session, activeRepo, setActiveRepo, onImportRepo, onDisconnect }) {
  const u = session.user;
  const repos = window.MOCK_GITHUB.repos;
  const files = activeRepo ? window.MOCK_GITHUB.files[activeRepo.name] : null;

  return (
    <>
      <div className="fp-conn-bar">
        <div className="fp-avatar gh">{u.avatar}</div>
        <div className="fp-conn-meta">
          <div>{u.name}</div>
          <div className="fp-conn-sub">@{u.login}</div>
        </div>
        <button onClick={onDisconnect} className="fp-btn ghost">{t("disconnect")}</button>
      </div>

      {!activeRepo && (
        <div className="fp-section">
          <div className="fp-section-head">{t("repos")} · {repos.length}</div>
          <ul className="fp-list">
            {repos.map((r) => (
              <li key={r.name} className="fp-row gh-repo" onClick={() => setActiveRepo(r)}>
                <span className="fp-row-icon"><Icon name="folder" size={12} /></span>
                <div className="fp-row-mid">
                  <div className="fp-row-name">
                    <span>{u.login}/<b>{r.name}</b></span>
                    <span className={"vis " + r.visibility}>{r.visibility}</span>
                  </div>
                  <div className="fp-row-sub">{r.desc}</div>
                  <div className="fp-row-stats">
                    <span><span className="ld" style={{ background: r.langColor }} />{r.lang}</span>
                    <span>★ {r.stars}</span>
                    <span>{r.updated}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeRepo && (
        <div className="fp-section">
          <div className="fp-section-head">
            <button className="fp-back" onClick={() => setActiveRepo(null)}>← {t("repos")}</button>
            <span style={{ marginLeft: 8 }}><b>{activeRepo.name}</b></span>
            {files && files.some((f) => f.content) && (
              <button className="fp-btn primary fp-import-all"
                onClick={() => { onImportRepo(activeRepo); }}>
                <Icon name="download" size={11} />{t("import_file")}
              </button>
            )}
          </div>
          {!files && <div className="fp-empty">{t("no_repo_files")}</div>}
          {files && (
            <ul className="fp-list">
              {files.map((f) => (
                <li key={f.name} className="fp-row">
                  <span className="fp-row-icon">
                    {f.type === "dir" ? <Icon name="folder" size={12} /> : <Icon name="code" size={12} />}
                  </span>
                  <span className="fp-row-name">{f.name}</span>
                  <span className="fp-row-meta">{f.size || ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function GdFiles({ t, onImport, onDisconnect }) {
  const u = window.MOCK_GDRIVE.user;
  const files = window.MOCK_GDRIVE.files;
  const iconColor = { fig: "#a259ff", pdf: "#e55765", doc: "#4285f4", gdoc: "#4285f4", img: "#34a853", svg: "#fb8c00" };
  return (
    <>
      <div className="fp-conn-bar">
        <div className="fp-avatar gd"><GdIcon /></div>
        <div className="fp-conn-meta">
          <div>{u.name}</div>
          <div className="fp-conn-sub">{u.email}</div>
        </div>
        <button onClick={onDisconnect} className="fp-btn ghost">{t("disconnect")}</button>
      </div>

      <div className="fp-section">
        <div className="fp-section-head">My Drive · {files.length}</div>
        <ul className="fp-list">
          {files.map((f, i) => (
            <li key={i} className="fp-row">
              <span className="fp-row-icon">
                {f.type === "folder"
                  ? <Icon name="folder" size={12} />
                  : <span className="ext-chip" style={{ background: iconColor[f.icon] || "#888" }}>{f.icon}</span>}
              </span>
              <div className="fp-row-mid">
                <div className="fp-row-name">{f.name}</div>
                <div className="fp-row-stats">
                  <span>{f.size || ""}</span>
                  <span>{f.mod || ""}</span>
                </div>
              </div>
              {f.asset && (
                <button className="fp-btn ghost small" onClick={() => onImport(f)}>
                  <Icon name="plus" size={10} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
