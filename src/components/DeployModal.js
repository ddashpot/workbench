/* Deploy flow: configure → preview files → deploy (simulated) → show result. */
const { useState: dmUseState, useEffect: dmUseEffect, useMemo: dmUseMemo } = React;

window.DeployModal = function ({ t, language, project, onClose, onConnectGitHub }) {
  const ghSession = window.useGitHubAuth();
  const [step, setStep] = dmUseState("config");
  const [pat, setPat] = dmUseState(() => ghSession?.token || localStorage.getItem("wb.gh.pat") || "");
  const [repo, setRepo] = dmUseState(() => localStorage.getItem("wb.deploy.repo") || "");
  const [repoMode, setRepoMode] = dmUseState("existing"); // existing | new
  const [newRepoName, setNewRepoName] = dmUseState("");
  const [branch, setBranch] = dmUseState(() => localStorage.getItem("wb.deploy.branch") || "gh-pages");
  const [visibility, setVisibility] = dmUseState("public");
  const [domain, setDomain] = dmUseState(() => localStorage.getItem("wb.deploy.domain") || "");
  const [customDomain, setCustomDomain] = dmUseState("");
  const [showRepos, setShowRepos] = dmUseState(false);

  const [progress, setProgress] = dmUseState(0);
  const [logs, setLogs] = dmUseState([]);
  const [result, setResult] = dmUseState(null);

  /* Auto-fill PAT when OAuth completes during the session. */
  dmUseEffect(() => {
    if (ghSession?.token && !pat) setPat(ghSession.token);
  }, [ghSession]);

  const user = window.MOCK_GITHUB.user;
  const repoList = window.MOCK_GITHUB.repos;
  const projectFiles = Object.entries(project?.files || {});
  const totalBytes = projectFiles.reduce((s, [, c]) => s + (c?.length || 0), 0);

  const repoSuggestions = dmUseMemo(() => {
    const q = repo.toLowerCase();
    return repoList.filter((r) => r.name.toLowerCase().includes(q));
  }, [repo]);

  const finalRepo = repoMode === "new" ? newRepoName.trim() : repo.trim();
  const finalDomain = domain === "__manual__" ? customDomain.trim() : domain;
  const siteUrl = finalDomain
    ? `https://${finalDomain}/`
    : `https://${user.login}.github.io/${finalRepo || "<repo>"}/`;
  const canDeploy = pat.length >= 8 && finalRepo && projectFiles.length > 0;

  function persist() {
    localStorage.setItem("wb.gh.pat", pat);
    localStorage.setItem("wb.deploy.repo", repo);
    localStorage.setItem("wb.deploy.branch", branch);
    localStorage.setItem("wb.deploy.domain", domain);
  }

  function addLog(msg, kind = "info") {
    setLogs((l) => [...l, { ts: Date.now(), kind, msg }]);
  }

  async function startDeploy() {
    persist();
    setStep("running");
    setLogs([]);
    setProgress(0);

    const steps = [
      ["info",  `Authenticating as @${user.login}…`, 8],
      ["info",  `Checking repository ${user.login}/${finalRepo}…`, 14],
      repoMode === "new" ? ["info", `Creating new repo (${visibility})…`, 22] : ["info", `Using existing repo`, 22],
      ["info",  `Preparing ${projectFiles.length} file(s) · ${(totalBytes / 1024).toFixed(1)} KB…`, 36],
      ...projectFiles.map(([name], i) => ["file", `Uploading ${name}`, 36 + ((i + 1) / projectFiles.length) * 38]),
      ["info",  `Committing to ${branch}…`, 80],
      ["info",  `Enabling GitHub Pages…`, 88],
      finalDomain ? ["info", `Configuring custom domain ${finalDomain}…`, 92] : ["info", `Using github.io subdomain`, 92],
      ["info",  `Waiting for build…`, 96],
      ["ok",    `Deploy succeeded.`, 100],
    ];

    for (const [kind, msg, p] of steps) {
      addLog(msg, kind);
      setProgress(p);
      await new Promise((r) => setTimeout(r, 280 + Math.random() * 280));
    }
    setResult({
      site: siteUrl,
      repo: `https://github.com/${user.login}/${finalRepo}`,
      branch,
      commit: "c" + Math.random().toString(36).slice(2, 9),
      ts: Date.now(),
    });
    setStep("done");
  }

  function reset() {
    setStep("config"); setProgress(0); setLogs([]); setResult(null);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-deploy" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/>
            </svg>
            {t("deploy_github")}
          </span>
          <div className="dm-steps">
            <span className={"dm-step " + (step === "config" ? "on" : "")}>1. Configure</span>
            <span className={"dm-step " + (step === "running" ? "on" : (step === "done" ? "ok" : ""))}>2. Deploy</span>
            <span className={"dm-step " + (step === "done" ? "on" : "")}>3. Done</span>
          </div>
          <button className="pt-icon-btn" onClick={onClose}><Icon name="close" size={12} /></button>
        </div>

        {step === "config" && (
          <div className="modal-body">
            <div className="modal-note">
              {language === "ja"
                ? "プロジェクトの index.html / styles.css / app.js を GitHub Pages にデプロイします。実際の API 呼び出しはデモです（PAT は localStorage に保存）。"
                : "Deploy your project files to GitHub Pages. API calls are mocked (PAT is stored in localStorage)."}
            </div>

            <div className="form-row">
              <label>{language === "ja" ? "GitHubアカウント" : "GitHub account"}</label>
              {ghSession ? (
                <div className="gh-account-chip">
                  <div className="gh-avatar">{ghSession.user.avatar}</div>
                  <div className="gh-meta">
                    <div className="gh-name">{ghSession.user.name}</div>
                    <div className="gh-sub">@{ghSession.user.login}</div>
                  </div>
                  <span className="gh-status">{language === "ja" ? "OAuth" : "OAuth"}</span>
                </div>
              ) : (
                <button
                  className="fp-btn primary"
                  type="button"
                  onClick={onConnectGitHub}
                  style={{ width: "fit-content" }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/></svg>
                  {language === "ja" ? "GitHubでサインイン" : "Sign in with GitHub"}
                </button>
              )}
            </div>

            <div className="form-row">
              <label>{ghSession ? (language === "ja" ? "アクセストークン (自動)" : "Access token (auto)") : "GitHub PAT"}</label>
              <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="ghp_…" />
            </div>

            <div className="form-row">
              <label>{t("deploy_repo")}</label>
              <div className="repo-mode-seg">
                <button className={repoMode === "existing" ? "on" : ""} onClick={() => setRepoMode("existing")}>
                  {language === "ja" ? "既存リポジトリ" : "Existing repo"}
                </button>
                <button className={repoMode === "new" ? "on" : ""} onClick={() => setRepoMode("new")}>
                  {language === "ja" ? "新規作成" : "Create new"}
                </button>
              </div>
              {repoMode === "existing" ? (
                <div className="repo-search">
                  <input
                    value={repo}
                    onChange={(e) => { setRepo(e.target.value); setShowRepos(true); }}
                    onFocus={() => setShowRepos(true)}
                    placeholder={t("select_repo")}
                  />
                  {showRepos && repoSuggestions.length > 0 && (
                    <div className="repo-dropdown">
                      {repoSuggestions.slice(0, 6).map((r) => (
                        <button key={r.name} className="repo-item"
                          onMouseDown={(e) => { e.preventDefault(); setRepo(r.name); setShowRepos(false); }}>
                          <Icon name="folder" size={11} />
                          <span className="ri-name">{user.login}/<b>{r.name}</b></span>
                          <span className={"vis " + r.visibility}>{r.visibility}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="my-new-site" />
                  <div className="form-row two" style={{ marginTop: 8 }}>
                    <div>
                      <label>Visibility</label>
                      <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    <div>
                      <label>{t("deploy_branch")}</label>
                      <input value={branch} onChange={(e) => setBranch(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {repoMode === "existing" && (
              <div className="form-row">
                <label>{t("deploy_branch")}</label>
                <input value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
            )}

            <div className="form-row">
              <label>{language === "ja" ? "公開ドメイン" : "Domain"}</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">{language === "ja" ? "GitHub Pages 標準 URL" : "Default github.io URL"}</option>
                <option value="__manual__">{language === "ja" ? "独自ドメイン…" : "Custom domain…"}</option>
              </select>
              {domain === "__manual__" && (
                <input style={{ marginTop: 6 }} value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)} placeholder="example.com" />
              )}
            </div>

            <div className="deploy-files">
              <div className="df-head">
                <Icon name="folder" size={12} />
                <span>{language === "ja" ? "デプロイ対象" : "Files to deploy"}</span>
                <span className="df-count">{projectFiles.length} files · {(totalBytes / 1024).toFixed(1)} KB</span>
              </div>
              <ul className="df-list">
                {projectFiles.map(([name, content]) => {
                  const ext = name.split(".").pop();
                  const c = { html: "#e34c26", css: "#264de4", js: "#f7df1e" }[ext] || "#888";
                  return (
                    <li key={name}>
                      <span className="ld" style={{ background: c }} />
                      <span className="df-name">{name}</span>
                      <span className="df-size">{((content?.length || 0) / 1024).toFixed(1)} KB</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="deploy-preview">
              <span className="dp-label">URL preview</span>
              <code>{siteUrl}</code>
            </div>
          </div>
        )}

        {step === "running" && (
          <div className="modal-body">
            <div className="deploy-progress-bar">
              <div className="dpb-fill" style={{ width: progress + "%" }} />
              <span className="dpb-label">{Math.round(progress)}%</span>
            </div>
            <div className="deploy-log">
              {logs.map((l, i) => (
                <div key={i} className={"dl-line " + l.kind}>
                  <span className="dl-arrow">›</span>
                  <span className="dl-msg">{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="modal-body">
            <div className="deploy-success">
              <div className="ds-check"><Icon name="check" size={20} /></div>
              <div className="ds-title">{language === "ja" ? "デプロイ完了" : "Deploy complete"}</div>
              <div className="ds-sub">commit {result.commit} · {branch}</div>
            </div>
            <a className="deploy-link" href={result.site} target="_blank" rel="noreferrer">
              <Icon name="expand" size={12} />
              <span className="dl-label">{language === "ja" ? "サイトを開く" : "Open site"}</span>
              <code>{result.site}</code>
            </a>
            <a className="deploy-link" href={result.repo} target="_blank" rel="noreferrer">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/></svg>
              <span className="dl-label">{language === "ja" ? "リポジトリを開く" : "Open repository"}</span>
              <code>{result.repo}</code>
            </a>
          </div>
        )}

        <div className="modal-foot">
          {step === "config" && (
            <>
              <button className="fp-btn ghost" onClick={onClose}>{t("cancel")}</button>
              <button className="fp-btn primary" onClick={startDeploy} disabled={!canDeploy}>
                <Icon name="play" size={11} />{language === "ja" ? "デプロイ開始" : "Start deploy"}
              </button>
            </>
          )}
          {step === "running" && (
            <button className="fp-btn ghost" onClick={onClose}>{language === "ja" ? "閉じる" : "Close"}</button>
          )}
          {step === "done" && (
            <>
              <button className="fp-btn ghost" onClick={reset}>{language === "ja" ? "再デプロイ" : "Redeploy"}</button>
              <button className="fp-btn primary" onClick={onClose}>{language === "ja" ? "完了" : "Done"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
