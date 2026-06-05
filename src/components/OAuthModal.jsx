/* GitHub OAuth — authorize page mockup.
   Mimics the look of github.com/login/oauth/authorize. Once the user
   clicks "Authorize", GitHubAuth.completeAuthorize() returns a session. */
const { useState: oUseState, useEffect: oUseEffect } = React;

window.GitHubOAuthModal = function ({ t, language, onClose, onConnected }) {
  const [phase, setPhase] = oUseState("authorize"); // authorize | exchanging | done | error
  const [error, setError] = oUseState(null);
  const cfg = window.GITHUB_OAUTH;
  const user = window.MOCK_GITHUB.user;

  /* Build the URL the real flow would redirect to. We show it as a hint. */
  const authorizeUrl = `${cfg.AUTHORIZE_URL}?client_id=${cfg.CLIENT_ID}` +
    `&scope=${encodeURIComponent(cfg.SCOPES.join(" "))}` +
    `&redirect_uri=${encodeURIComponent(cfg.REDIRECT_URI)}` +
    `&state=${window.GitHubAuth.beginAuthorize().slice(0, 12)}`;

  async function authorize() {
    setPhase("exchanging");
    setError(null);
    try {
      const fakeCode = "code_" + Math.random().toString(36).slice(2, 10);
      const session = await window.GitHubAuth.completeAuthorize({
        code: fakeCode,
        state: sessionStorage.getItem("wb.gh.state"),
      });
      setPhase("done");
      setTimeout(() => { onConnected?.(session); onClose(); }, 600);
    } catch (e) {
      setError(e.message || String(e));
      setPhase("error");
    }
  }

  const scopeDescriptions = {
    "repo": language === "ja" ? "リポジトリへの読み書き（プライベート含む）" : "Read/write access to your repositories (incl. private)",
    "delete_repo": language === "ja" ? "リポジトリの削除" : "Delete repositories",
    "read:user": language === "ja" ? "プロフィール情報の読み取り" : "Read your profile information",
    "user:email": language === "ja" ? "メールアドレスの参照" : "Read your email addresses",
  };

  return (
    <div className="modal-backdrop" onClick={phase === "exchanging" ? null : onClose}>
      <div className="modal modal-oauth" onClick={(e) => e.stopPropagation()}>
        <div className="oauth-head">
          <div className="oauth-brand">
            <svg width="32" height="32" viewBox="0 0 16 16" fill="#fff">
              <path d="M8 .2A8 8 0 0 0 5.5 15.8c.4.07.55-.18.55-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.95-.95-1.2-.95-1.2-.78-.55.06-.53.06-.53.85.06 1.3.88 1.3.88.78 1.32 2.04.94 2.54.72.07-.57.3-.95.55-1.17-1.75-.2-3.6-.88-3.6-3.9 0-.86.3-1.57.82-2.12-.08-.2-.36-1 .07-2.1 0 0 .67-.22 2.2.8a7.5 7.5 0 0 1 4 0c1.53-1.02 2.2-.8 2.2-.8.43 1.1.16 1.9.08 2.1.5.55.82 1.26.82 2.12 0 3.04-1.85 3.7-3.6 3.9.3.26.57.77.57 1.55v2.3c0 .22.15.48.55.4A8 8 0 0 0 8 .2z"/>
            </svg>
          </div>
          <div className="oauth-host">github.com</div>
          <button className="pt-icon-btn oauth-close" onClick={onClose}>
            <Icon name="close" size={12} />
          </button>
        </div>

        {phase === "authorize" && (
          <div className="oauth-body">
            <div className="oauth-pair">
              <div className="oauth-side oauth-side-app">
                <div className="oauth-logo wb">
                  <div className="brand-mark" />
                </div>
                <div className="oauth-name">Workbench</div>
              </div>
              <div className="oauth-arrow">↔</div>
              <div className="oauth-side">
                <div className="oauth-logo gh-avatar">{user.avatar}</div>
                <div className="oauth-name">{user.name}</div>
              </div>
            </div>

            <h2 className="oauth-title">
              {language === "ja"
                ? <><b>Workbench</b> がリクエストしています</>
                : <>Authorize <b>Workbench</b></>}
            </h2>
            <p className="oauth-sub">
              {language === "ja"
                ? <><b>{user.name}</b> として、以下のアクセス権を Workbench に許可します。</>
                : <>Grant Workbench access on behalf of <b>{user.name}</b>.</>}
            </p>

            <div className="oauth-scopes">
              {cfg.SCOPES.map((s) => (
                <div key={s} className="oauth-scope">
                  <span className="os-check"><Icon name="check" size={11} /></span>
                  <div className="os-text">
                    <code>{s}</code>
                    <span>{scopeDescriptions[s]}</span>
                  </div>
                </div>
              ))}
            </div>

            <details className="oauth-details">
              <summary>{language === "ja" ? "詳細" : "Details"}</summary>
              <div className="od-rows">
                <div><label>Client ID</label><code>{cfg.CLIENT_ID}</code></div>
                <div><label>Redirect</label><code>{cfg.REDIRECT_URI}</code></div>
                <div><label>Authorize URL</label><code>{authorizeUrl.slice(0, 80)}…</code></div>
              </div>
            </details>

            <div className="oauth-actions">
              <button className="oauth-btn cancel" onClick={onClose}>{t("cancel")}</button>
              <button className="oauth-btn primary" onClick={authorize}>
                {language === "ja" ? "Workbench を承認する" : "Authorize Workbench"}
              </button>
            </div>

            <div className="oauth-note">
              {language === "ja"
                ? "デモ用の模擬OAuth画面です。本物のフローでは GitHub.com の認可画面に遷移し、サーバ側でトークン交換します。"
                : "Mock OAuth flow. The real flow would redirect to github.com and exchange the code server-side."}
            </div>
          </div>
        )}

        {phase === "exchanging" && (
          <div className="oauth-body oauth-loading">
            <div className="oauth-spinner" />
            <div className="oauth-loading-text">
              {language === "ja" ? "トークンを交換しています…" : "Exchanging token…"}
            </div>
            <div className="oauth-loading-sub">
              POST {cfg.TOKEN_ENDPOINT}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="oauth-body oauth-success">
            <div className="ds-check"><Icon name="check" size={20} /></div>
            <div className="ds-title">
              {language === "ja" ? "接続完了" : "Connected"}
            </div>
            <div className="ds-sub">@{user.login}</div>
          </div>
        )}

        {phase === "error" && (
          <div className="oauth-body">
            <div className="oauth-error">
              <strong>{language === "ja" ? "エラー" : "Error"}</strong>
              <p>{error}</p>
            </div>
            <div className="oauth-actions">
              <button className="oauth-btn cancel" onClick={onClose}>{t("cancel")}</button>
              <button className="oauth-btn primary" onClick={authorize}>
                {language === "ja" ? "再試行" : "Retry"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* React hook for components to subscribe to GitHubAuth changes. */
window.useGitHubAuth = function () {
  const [session, setSession] = React.useState(() => window.GitHubAuth.get());
  React.useEffect(() => {
    function on(e) { setSession(e.detail); }
    window.addEventListener("wb-gh-auth-change", on);
    return () => window.removeEventListener("wb-gh-auth-change", on);
  }, []);
  return session;
};
