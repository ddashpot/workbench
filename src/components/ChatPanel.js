/* Unified chat panel — single message stream, mode picker lives in the composer. */
const { useState: cpUseState, useRef: cpUseRef, useEffect: cpUseEffect } = React;

window.ChatPanel = function (props) {
  const {
    t, language,
    mode, setMode,
    messages,
    onSend, onEditAndResend, onRegenLast, onBranchFrom,
    onApplyBlock, onPermission, files,
    model, setModel, busy, onStop,
    customPrompt, setCustomPrompt,
    onNewChat,
  } = props;

  const [value, setValue] = cpUseState("");
  const [attachments, setAttachments] = cpUseState([]);
  const [showSettings, setShowSettings] = cpUseState(false);
  const scrollRef = cpUseRef(null);

  cpUseEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  function send() {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    onSend({ text, attachments, model, mode });
    setValue("");
    setAttachments([]);
  }

  function onQuickPrompt(textPrompt) {
    setValue(value ? (value + " " + textPrompt) : textPrompt);
  }

  const quickPrompts = [
    { label: t("quick_btn_dark"), text: t("quick_btn_dark") },
    { label: t("quick_btn_resp"), text: t("quick_btn_resp") },
    { label: t("quick_btn_anim"), text: t("quick_btn_anim") },
  ];

  const m = window.modeById(mode);
  const modeHint = t("mode_" + mode + "_hint");

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="ch-title">
          <Icon name="chat" size={13} />
          <span>{t("chat")}</span>
          <span className="ch-count">{messages.length}</span>
        </div>
        <span className="spacer" />
        <button className="ch-icon-btn" onClick={onNewChat} title={t("new_chat")}>
          <Icon name="plus" size={12} />
        </button>
        <button
          className={"ch-icon-btn " + (showSettings ? "on" : "")}
          onClick={() => setShowSettings((s) => !s)}
          title={t("custom_prompt")}
        >
          <Icon name="settings" size={12} />
        </button>
      </div>

      {showSettings && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            {t("custom_prompt")}
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t("custom_prompt_ph")}
            style={{ width: "100%", minHeight: 80, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 10px", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>
      )}

      <div className={"chat-scroll " + (messages.length === 0 ? "is-empty" : "")} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="ce-icon" style={{ background: m.color }}>
              <Icon name={m.icon} size={18} />
            </div>
            <div className="ce-mode">{language === "ja" ? m.label_ja : m.label_en}</div>
            <div className="ce-hint">{modeHint}</div>
            <div className="ce-examples">
              {mode === "ui" && <div>{t("no_messages_ui")}</div>}
              {mode === "logic" && <div>{t("no_messages_logic")}</div>}
              {mode === "plan" && <div>{language === "ja" ? "「Todoアプリの構成を考えて」" : "“Outline a todo app”"}</div>}
              {mode === "debug" && <div>{language === "ja" ? "コンソールタブを開いて、エラーを見ながら相談" : "Inspect Console tab, then describe the bug"}</div>}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <Message
              key={m.id}
              msg={m}
              files={files}
              t={t}
              language={language}
              onApplyBlock={(b) => onApplyBlock(b, m.id)}
              onPermission={onPermission}
              onEdit={() => {
                setValue(m.content);
                onEditAndResend(m.id);
              }}
              onRegen={() => onRegenLast(m.id)}
              onBranch={() => onBranchFrom(m.id)}
            />
          ))
        )}
      </div>

      <Composer
        value={value} setValue={setValue}
        onSend={send}
        model={model} setModel={setModel}
        mode={mode} setMode={setMode}
        t={t} language={language} busy={busy} onStop={onStop}
        attachments={attachments} setAttachments={setAttachments}
        quickPrompts={messages.length > 0 ? quickPrompts : null}
        onQuickPrompt={onQuickPrompt}
      />
    </div>
  );
};
