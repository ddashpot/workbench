/* Settings popover panel. */
window.SettingsPanel = function ({ t, language, setLanguage, target, setTarget, customPrompt, setCustomPrompt, onConnectGitHub, onClose }) {
  const ghSession = window.useGitHubAuth();
  return (
    <div className="files-panel settings-panel" onClick={(e) => e.stopPropagation()}>
      <div className="hp-head">
        <span className="hp-title">{t("settings")}</span>
        <button onClick={onClose} className="pt-icon-btn"><Icon name="close" size={12} /></button>
      </div>
      <div className="fp-body">
        <div className="settings-section">
          <label>{language === "ja" ? "言語" : "Language"}</label>
          <div className="seg">
            <button className={language === "ja" ? "on" : ""} onClick={() => setLanguage("ja")}>日本語</button>
            <button className={language === "en" ? "on" : ""} onClick={() => setLanguage("en")}>English</button>
          </div>
        </div>

        <div className="settings-section">
          <label>{t("target")}</label>
          <div className="seg">
            <button className={target === "pc" ? "on" : ""} onClick={() => setTarget("pc")}>
              <Icon name="desktop" size={12} /> {t("target_pc")}
            </button>
            <button className={target === "mobile" ? "on" : ""} onClick={() => setTarget("mobile")}>
              <Icon name="mobile" size={12} /> {t("target_mobile")}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <label>GitHub</label>
          {ghSession ? (
            <>
              <div className="gh-account-chip">
                <div className="gh-avatar">{ghSession.user.avatar}</div>
                <div className="gh-meta">
                  <div className="gh-name">{ghSession.user.name}</div>
                  <div className="gh-sub">@{ghSession.user.login} · token: {ghSession.token.slice(0, 8)}…</div>
                </div>
                <span className="gh-status">{language === "ja" ? "接続中" : "Connected"}</span>
              </div>
              <div className="gh-scopes-row">
                {ghSession.scopes.map((s) => <span key={s} className="gh-scope-chip">{s}</span>)}
              </div>
              <button onClick={() => window.GitHubAuth.clear()}
                className="fp-btn ghost" style={{ marginTop: 8, width: "fit-content" }}>
                <Icon name="close" size={11} />
                {language === "ja" ? "サインアウト" : "Sign out"}
              </button>
            </>
          ) : (
            <button onClick={onConnectGitHub} className="fp-btn primary" style={{ width: "fit-content" }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/></svg>
              {language === "ja" ? "GitHubでサインイン" : "Sign in with GitHub"}
            </button>
          )}
        </div>

        <div className="settings-section">
          <label>{t("custom_prompt")}</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t("custom_prompt_ph")}
          />
        </div>

        <div className="settings-section settings-about">
          <label>Workbench</label>
          <div className="settings-meta">
            <div>v0.5 · AI-paired HTML/CSS/JS sandbox</div>
            <div>Claude / Gemini / GPT · GitHub · GDrive</div>
          </div>
        </div>
      </div>
    </div>
  );
};
