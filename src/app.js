/* Main App. Wires everything together. */
const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem("wb.lang") || "ja");
  const t = window.useI18N(language);

  // Project / files
  const [project, setProject] = useState(null);
  const [showGallery, setShowGallery] = useState(true);
  const [chatW, setChatW] = useState(() => Number(localStorage.getItem("wb.chatW")) || 440);
  const [target, setTarget] = useState(() => localStorage.getItem("wb.target") || "pc");

  // Chat state
  const [mode, setMode] = useState("ui");
  const [model, setModel] = useState("claude-sonnet");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef({ aborted: false });

  // Right-side state
  const [view, setView] = useState("preview");
  const [device, setDevice] = useState("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(null); // {id, tag, label} or null

  // Side popovers
  const [sideOpen, setSideOpen] = useState(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [mobileView, setMobileView] = useState("chat"); // chat | preview
  const [mobilePreviewH, setMobilePreviewH] = useState(() => Number(localStorage.getItem("wb.mobileH")) || 42);
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem("wb.customPrompt") || "");
  const [showOAuth, setShowOAuth] = useState(false);
  const [ghConnecting, setGhConnecting] = useState(false);
  const [diskProjects, setDiskProjects] = useState([]); // [{name, mtime}]
  const [activeProject, setActiveProject] = useState(null);
  const [promptLayers, setPromptLayers] = useState({ app: "", defaultApp: "", global: "", project: "" });
  const [skillsAvail, setSkillsAvail] = useState([]);   // [{name, desc}]
  const [skillsEnabled, setSkillsEnabled] = useState([]); // [name]

  // Toasts
  const [toasts, setToasts] = useState([]);
  function toast(t) {
    const id = Math.random();
    setToasts((arr) => [...arr, { id, ...t }]);
    setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 3000);
  }

  useEffect(() => { localStorage.setItem("wb.lang", language); }, [language]);
  useEffect(() => { localStorage.setItem("wb.customPrompt", customPrompt); }, [customPrompt]);
  useEffect(() => { localStorage.setItem("wb.chatW", chatW); }, [chatW]);
  useEffect(() => { localStorage.setItem("wb.mobileH", mobilePreviewH); }, [mobilePreviewH]);
  useEffect(() => {
    localStorage.setItem("wb.target", target);
    // Mirror target into preview device when target changes
    setDevice(target === "mobile" ? "mobile" : "desktop");
  }, [target]);

  // Restore project
  useEffect(() => {
    const raw = localStorage.getItem("wb.project");
    if (raw) {
      try {
        const p = JSON.parse(raw);
        // Migrate older shape: uiMessages + logicMessages -> messages
        if (!p.messages) {
          const ui = (p.uiMessages || []).map((m) => ({ ...m, mode: m.mode || "ui" }));
          const lo = (p.logicMessages || []).map((m) => ({ ...m, mode: m.mode || "logic" }));
          p.messages = [...ui, ...lo].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        }
        delete p.uiMessages; delete p.logicMessages;
        setProject(p); setShowGallery(false);
      } catch (e) {}
    }
  }, []);
  useEffect(() => {
    if (project) localStorage.setItem("wb.project", JSON.stringify(project));
  }, [project]);

  // Handle the GitHub OAuth redirect callback (?code=…) once on load.
  useEffect(() => {
    if (!window.GitHubAuth.hasPendingCallback()) return;
    setGhConnecting(true);
    window.GitHubAuth.handleCallback()
      .then((s) => {
        if (s) toast({ kind: "success",
          title: language === "ja" ? "GitHubと接続しました" : "Signed in to GitHub",
          msg: "@" + s.user.login });
      })
      .catch((e) => toast({ kind: "error",
        title: language === "ja" ? "GitHub接続に失敗" : "GitHub sign-in failed",
        msg: e.message || String(e) }))
      .finally(() => setGhConnecting(false));
  }, []);

  // Console listener
  useEffect(() => {
    function onMsg(e) {
      const d = e.data || {};
      if (d.__preview_console) {
        setLogs((l) => [...l.slice(-199), { kind: d.kind, data: d.data, ts: d.ts }]);
      }
      if (d.__wb_drag) {
        setProject((p) => p ? { ...p, overrides: { ...(p.overrides || {}), [d.id]: { x: d.x, y: d.y } } } : p);
      }
      if (d.__wb_drag_live) {
        setProject((p) => p ? { ...p, overrides: { ...(p.overrides || {}), [d.id]: { x: d.x, y: d.y } } } : p);
      }
      if ("__wb_select" in d) {
        if (d.__wb_select === null) setSelected(null);
        else setSelected({ id: d.__wb_select, tag: d.tag || "", label: d.label || "" });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Backend bridge: agent edits on disk -> mirror into the UI; permission gate.
  useEffect(() => {
    const off = window.__wbBridge.on((m) => {
      if (m.type === "files_changed") {
        const files = m.files || {};
        if (!Object.keys(files).length) return;
        setProject((p) => (p ? { ...p, files: { ...p.files, ...files } } : p));
        setIframeKey((k) => k + 1);
      } else if (m.type === "permission_request") {
        setProject((p) => p ? { ...p, messages: [...(p.messages || []), {
          id: "perm_" + m.id, permId: m.id, role: "assistant", kind: "gate",
          tool_name: m.tool_name, input: m.input, ts: Date.now(), resolved: null,
        }] } : p);
      } else if (m.type === "permission_resolved") {
        setProject((p) => p ? { ...p, messages: (p.messages || []).map((x) =>
          x.permId === m.id && x.resolved == null ? { ...x, resolved: m.decision } : x) } : p);
      } else if (m.type === "projects") {
        setDiskProjects(m.list || []);
        setActiveProject(m.active || null);
      } else if (m.type === "prompts") {
        setPromptLayers({ app: m.app || "", defaultApp: m.defaultApp || "", global: m.global || "", project: m.project || "" });
      } else if (m.type === "skills") {
        setSkillsAvail(m.available || []);
        setSkillsEnabled(m.enabled || []);
      } else if (m.type === "error") {
        toast({ kind: "error", title: "Agent", msg: m.message });
      } else if (m.type === "notice") {
        toast({ kind: "success", title: "Agent", msg: m.text });
      }
    });
    return off;
  }, []);

  // ---- disk project management (multi-project) --------------------------
  function openDiskProject(name) {
    window.__wbBridge.send({ type: "open_project", name });
    setActiveProject(name);
    setProject({ name, files: {}, messages: [], versions: [], currentVersionId: null, overrides: {}, disk: true });
    setShowGallery(false);
    setSideOpen(null);
    setLogs([]);
    setIframeKey((k) => k + 1);
  }
  function createDiskProject(name) {
    window.__wbBridge.send({ type: "create_project", name });
    setActiveProject(name);
    setProject({ name, files: {}, messages: [], versions: [], currentVersionId: null, overrides: {}, disk: true });
    setShowGallery(false);
    setSideOpen(null);
    setLogs([]);
    setIframeKey((k) => k + 1);
  }

  // ---- layered prompts & skills -----------------------------------------
  function savePrompts(next) {
    window.__wbBridge.send({ type: "set_prompts", app: next.app, global: next.global, project: next.project });
    toast({ kind: "success", title: language === "ja" ? "プロンプトを保存" : "Prompts saved", msg: "" });
  }
  function toggleSkill(name) {
    setSkillsEnabled((cur) => {
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
      window.__wbBridge.send({ type: "set_skills", names: next });
      return next;
    });
  }

  // Mirror the layered prompt inputs to the backend (writes project CLAUDE.md).
  useEffect(() => {
    window.wbSetCustom({ text: customPrompt, language, target });
  }, [customPrompt, language, target]);

  // Operator's allow/deny on a permission gate.
  function onPermission(permId, decision) {
    window.wbSendPermission(permId, decision);
    setProject((p) => p ? { ...p, messages: (p.messages || []).map((x) =>
      x.permId === permId && x.resolved == null ? { ...x, resolved: decision } : x) } : p);
  }

  // ---- Project actions --------------------------------------------------
  function pickTemplate(tpl) {
    const v0 = {
      id: "v_" + Date.now(),
      label: language === "ja" ? "初期バージョン" : "Initial",
      note: (language === "ja" ? "テンプレート: " : "Template: ") + (language === "ja" ? tpl.name_ja : tpl.name_en),
      ts: Date.now(),
      files: { ...tpl.files },
    };
    setProject({
      name: language === "ja" ? tpl.name_ja : tpl.name_en,
      template: tpl.id,
      files: { ...tpl.files },
      messages: [],
      versions: [v0],
      currentVersionId: v0.id,
      overrides: {},
    });
    setLogs([]);
    setShowGallery(false);
    setIframeKey((k) => k + 1);
  }

  function updateFiles(nextFiles, note) {
    setProject((p) => {
      if (!p) return p;
      const v = {
        id: "v_" + Date.now(),
        label: (language === "ja" ? "v" : "v") + (p.versions.length + 1),
        note: note || (language === "ja" ? "ファイル更新" : "Files updated"),
        ts: Date.now(),
        files: nextFiles,
      };
      return {
        ...p,
        files: nextFiles,
        versions: [...p.versions, v],
        currentVersionId: v.id,
      };
    });
    setIframeKey((k) => k + 1);
  }

  function selectVersion(id) {
    setProject((p) => {
      if (!p) return p;
      const v = p.versions.find((x) => x.id === id);
      if (!v) return p;
      return { ...p, files: { ...v.files }, currentVersionId: id };
    });
    setIframeKey((k) => k + 1);
    toast({ kind: "success", title: t("revert_done"), msg: "" });
  }

  function renameVersion(id, label) {
    setProject((p) => ({ ...p,
      versions: p.versions.map((v) => v.id === id ? { ...v, label } : v)
    }));
  }

  function importExternalFiles(filesPatch, note) {
    if (!project) return;
    updateFiles({ ...project.files, ...filesPatch }, note || "Imported");
    toast({ kind: "success", title: t("file_imported"), msg: Object.keys(filesPatch).join(", ") });
    setSideOpen(null);
  }

  // ---- Chat actions -----------------------------------------------------
  async function onSend({ text, attachments, model: msgModel, mode: msgMode }) {
    if (!project) return;
    const userMsg = {
      id: "m_" + Date.now(),
      role: "user",
      content: text,
      model: msgModel,
      mode: msgMode,
      ts: Date.now(),
      attachments,
    };
    const assistantId = "m_" + (Date.now() + 1);
    const assistantMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      model: msgModel,
      mode: msgMode,
      ts: Date.now() + 1,
      streaming: true,
      appliedBlocks: {},
    };

    setProject((p) => ({
      ...p,
      messages: [...(p.messages || []), userMsg, assistantMsg],
    }));

    await runGeneration({ assistantId, mode: msgMode, model: msgModel, attachments });
  }

  async function runGeneration({ assistantId, mode: genMode, model: modelId, attachments }) {
    setBusy(true);
    abortRef.current = { aborted: false };
    const sig = abortRef.current;
    const m = window.modelById(modelId);

    try {
      const sys = window.buildSystemPrompt({
        mode: genMode,
        files: project.files,
        custom: customPrompt,
        persona: m.persona,
        language,
        target,
        logs,
      });

      const history = (project.messages || [])
        .filter((x) => x.id !== assistantId)
        .map((x) => ({ role: x.role, content: x.content + (x.attachments?.length ? `\n[attached: ${x.attachments.map(a=>a.name).join(", ")}]` : "") }));

      let acc = "";
      await window.streamComplete({
        systemPrompt: sys,
        messages: history,
        signal: sig,
        onChunk: (c) => {
          if (sig.aborted) return;
          acc += c;
          setProject((p) => updateMsg(p, assistantId, { content: acc, streaming: true }));
        },
      });
      if (sig.aborted) {
        setProject((p) => updateMsg(p, assistantId, { content: acc + "\n\n_(stopped)_", streaming: false }));
      } else {
        setProject((p) => updateMsg(p, assistantId, { content: acc, streaming: false }));
        const blocks = window.parseCodeBlocks(acc);
        if (blocks.length > 0) {
          toast({ kind: "success", title: t("status_streaming"),
                   msg: `${blocks.length} code block(s) returned — ${t("apply")}` });
        }
      }
    } catch (e) {
      console.error(e);
      setProject((p) => updateMsg(p, assistantId, {
        content: "⚠️ Error: " + (e?.message || String(e)),
        streaming: false,
      }));
      toast({ kind: "error", title: "Generation failed", msg: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  function updateMsg(p, id, patch) {
    return { ...p, messages: (p.messages || []).map((m) => (m.id === id ? { ...m, ...patch } : m)) };
  }

  function onStop() { abortRef.current.aborted = true; setBusy(false); }

  function onApplyBlock(block, msgId) {
    const fname = block.filename;
    const nextFiles = { ...project.files, [fname]: block.code };
    updateFiles(nextFiles,
      (language === "ja" ? "適用: " : "Applied: ") + fname);
    setProject((p) => ({
      ...p,
      messages: (p.messages || []).map((m) => m.id === msgId
        ? { ...m, appliedBlocks: { ...(m.appliedBlocks || {}), [fname]: block.code } } : m),
    }));
    toast({ kind: "success", title: t("status_applied"), msg: fname });
  }

  function onEditAndResend(msgId) {
    setProject((p) => {
      const i = (p.messages || []).findIndex((m) => m.id === msgId);
      if (i === -1) return p;
      return { ...p, messages: p.messages.slice(0, i) };
    });
  }

  function onRegenLast(assistantId) {
    if (busy) return;
    const msg = (project.messages || []).find((m) => m.id === assistantId);
    const useMode = msg?.mode || mode;
    setProject((p) => updateMsg(p, assistantId, { content: "", streaming: true, appliedBlocks: {} }));
    setTimeout(() => runGeneration({ assistantId, mode: useMode, model, attachments: [] }), 30);
  }

  function onBranchFrom(msgId) {
    setProject((p) => {
      const v = {
        id: "v_" + Date.now(),
        label: (language === "ja" ? "分岐 " : "branch ") + (p.versions.length + 1),
        note: language === "ja" ? "メッセージから分岐" : "Branched from message",
        ts: Date.now(),
        files: { ...p.files },
      };
      return { ...p, versions: [...p.versions, v], currentVersionId: v.id };
    });
    toast({ kind: "success", title: t("branch_added"), msg: t("branch") });
  }

  function onNewChat() {
    if (!project) return;
    setProject((p) => ({ ...p, messages: [] }));
  }

  function reloadIframe() { setIframeKey((k) => k + 1); }
  function openExternal() {
    const blob = new Blob([window.buildSrcDoc(project.files)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function onExport() {
    if (!project) return;
    // Export each file as a tiny zip-like manifest, or concatenate as a single bundle
    const bundle = window.buildSrcDoc(project.files);
    const blob = new Blob([bundle], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (project.name || "app") + ".html";
    a.click();
    toast({ kind: "success", title: t("export"), msg: a.download });
  }

  function onShare() {
    // Share = copy a data URI to clipboard (toy)
    const bundle = window.buildSrcDoc(project.files);
    const url = "data:text/html;charset=utf-8," + encodeURIComponent(bundle);
    navigator.clipboard.writeText(url).then(() => toast({ kind: "success", title: t("share"), msg: t("copied") }));
  }

  function onInsertComponent(c) {
    // Inject the component HTML at end of <body> in index.html
    const cur = project.files["index.html"] || "";
    const next = cur.replace(/<\/body>/i, c.code + "\n</body>");
    updateFiles({ ...project.files, "index.html": next },
      (language === "ja" ? "コンポーネント挿入: " : "Inserted: ") + c.name);
    toast({ kind: "success", title: c.name, msg: t("insert_comp") });
    setSideOpen(null);
  }

  // Resize gutter — column on desktop, row on mobile.
  const dragRef = useRef(null);
  function startDrag(e) {
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    dragRef.current = mobile
      ? { axis: "y", startY: e.clientY, startH: mobilePreviewH, vh: window.innerHeight }
      : { axis: "x", startX: e.clientX, startW: chatW };
    document.body.style.cursor = mobile ? "row-resize" : "col-resize";
    function move(ev) {
      const s = dragRef.current;
      if (s.axis === "y") {
        const dvh = ((ev.clientY - s.startY) / s.vh) * 100;
        const next = Math.max(15, Math.min(80, s.startH + dvh));
        setMobilePreviewH(next);
      } else {
        const d = ev.clientX - s.startX;
        const next = Math.max(320, Math.min(800, s.startW + d));
        setChatW(next);
      }
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // ----------------------------------------------------------------------
  if (!project || showGallery) {
    return (
      <div className="shell">
        <TopBar
          t={t} language={language} setLanguage={setLanguage}
          projectName={project ? project.name : t("untitled")}
          onRun={() => {}} onExport={() => {}} onShare={() => {}}
          busy={false}
          onShowGallery={() => setShowGallery(true)}
          target={target} setTarget={setTarget}
        />
        <div className="shell-body">
          <div className="sidebar">
            <button className="sb-btn on"><Icon name="template" /></button>
            <button className="sb-btn"><Icon name="folder" /></button>
            <button className="sb-btn"><Icon name="components" /></button>
            <button className="sb-btn"><Icon name="history" /></button>
            <div className="sb-divider" />
            <button className="sb-btn"><Icon name="settings" /></button>
          </div>
          <div style={{ position: "relative", minHeight: 0 }}>
            <TemplateGallery t={t} language={language} onPick={pickTemplate} />
          </div>
        </div>
        <StatusBar t={t} model={model} status="ready" busy={false} files={project?.files || {}} />
        <ToastStack toasts={toasts} />
        {ghConnecting && <GhConnecting language={language} />}
      </div>
    );
  }

  function setFocusChat() { setSideOpen(null); setMobileView("chat"); setMobilePreviewH(20); }
  function setFocusPreview() { setSideOpen(null); setMobileView("preview"); setMobilePreviewH(70); }
  function setFocusSplit() { setSideOpen(null); setMobilePreviewH(42); }

  return (
    <div className={"shell mobile-" + mobileView} style={{ "--chat-w": chatW + "px", "--mobile-preview-h": mobilePreviewH + "vh" }}>
      <TopBar
        t={t} language={language} setLanguage={setLanguage}
        projectName={project.name}
        onRun={reloadIframe} onExport={onExport} onShare={onShare}
        onDeploy={() => setShowDeploy(true)}
        busy={busy}
        onShowGallery={() => setShowGallery(true)}
        target={target} setTarget={setTarget}
      />
      <div className="shell-body">
        <div className="sidebar">
          <button className={"sb-btn " + (sideOpen === null && mobileView === "chat" ? "on" : "")} onClick={setFocusChat} title={t("chat")}>
            <Icon name="chat" />
          </button>
          <button className={"sb-btn mobile-only " + (mobileView === "preview" && !sideOpen ? "on" : "")} onClick={setFocusPreview} title={t("preview")}>
            <Icon name="eye" />
          </button>
          <button
            className={"sb-btn " + (sideOpen === "projects" ? "on" : "")}
            onClick={() => { if (sideOpen !== "projects") window.__wbBridge.send({ type: "list_projects" }); setSideOpen(sideOpen === "projects" ? null : "projects"); }}
            title={language === "ja" ? "プロジェクト" : "Projects"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2.5" y="5.5" width="13" height="9" rx="1.5" />
              <path d="M2.5 5.5l1.6-2.2a1 1 0 01.8-.4h3.1a1 1 0 01.8.4l1 1.4" />
            </svg>
          </button>
          <button
            className={"sb-btn " + (sideOpen === "prompts" ? "on" : "")}
            onClick={() => { if (sideOpen !== "prompts") { window.__wbBridge.send({ type: "get_prompts" }); window.__wbBridge.send({ type: "list_skills" }); } setSideOpen(sideOpen === "prompts" ? null : "prompts"); }}
            title={language === "ja" ? "プロンプト & スキル" : "Prompts & Skills"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M4 3.5h7l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-10a1 1 0 011-1z" />
              <path d="M6 8.5h6M6 11h6M6 6h3" />
            </svg>
          </button>
          <button className={"sb-btn " + (sideOpen === "files" ? "on" : "")} onClick={() => setSideOpen(sideOpen === "files" ? null : "files")} title={t("files")}>
            <Icon name="folder" />
          </button>
          <button className="sb-btn" onClick={() => setShowGallery(true)} title={t("templates")}>
            <Icon name="template" />
          </button>
          <button className={"sb-btn " + (sideOpen === "components" ? "on" : "")} onClick={() => setSideOpen(sideOpen === "components" ? null : "components")} title={t("components")}>
            <Icon name="components" />
          </button>
          <button className={"sb-btn " + (sideOpen === "history" ? "on" : "")} onClick={() => setSideOpen(sideOpen === "history" ? null : "history")} title={t("history")}>
            <Icon name="history" />
          </button>
          <div className="sb-divider" />
          <button
            className={"sb-btn " + (sideOpen === "settings" ? "on" : "")}
            onClick={() => setSideOpen(sideOpen === "settings" ? null : "settings")}
            title={t("settings")}
          >
            <Icon name="settings" />
          </button>
        </div>

        {sideOpen === "projects" && (
          <ProjectsPanel
            language={language}
            projects={diskProjects}
            active={activeProject}
            onOpen={openDiskProject}
            onCreate={createDiskProject}
            onClose={() => setSideOpen(null)}
          />
        )}
        {sideOpen === "prompts" && (
          <PromptsPanel
            language={language}
            layers={promptLayers}
            skillsAvail={skillsAvail}
            skillsEnabled={skillsEnabled}
            onSave={savePrompts}
            onToggleSkill={toggleSkill}
            onClose={() => setSideOpen(null)}
          />
        )}
        {sideOpen === "settings" && (
          <SettingsPanel
            t={t} language={language} setLanguage={setLanguage}
            target={target} setTarget={setTarget}
            customPrompt={customPrompt} setCustomPrompt={setCustomPrompt}
            onConnectGitHub={() => setShowOAuth(true)}
            onClose={() => setSideOpen(null)}
          />
        )}
        {sideOpen === "history" && (
          <HistoryPanel t={t} project={project}
            onSelect={selectVersion} onClose={() => setSideOpen(null)}
            onRenameVersion={renameVersion}
          />
        )}
        {sideOpen === "components" && (
          <ComponentsPanel t={t} onInsert={onInsertComponent} onClose={() => setSideOpen(null)} />
        )}
        {sideOpen === "files" && (
          <FilesPanel t={t} language={language} project={project}
            onImportFiles={importExternalFiles}
            onOpenLocal={(name) => { setView("code"); setSideOpen(null); }}
            onConnectGitHub={() => setShowOAuth(true)}
            onClose={() => setSideOpen(null)}
          />
        )}

        <div className="main">
          <ChatPanel
            t={t} language={language}
            mode={mode} setMode={setMode}
            messages={project.messages || []}
            onSend={onSend}
            onEditAndResend={onEditAndResend}
            onRegenLast={onRegenLast}
            onBranchFrom={onBranchFrom}
            onApplyBlock={onApplyBlock}
            onPermission={onPermission}
            files={project.files}
            model={model} setModel={setModel}
            busy={busy} onStop={onStop}
            customPrompt={customPrompt} setCustomPrompt={setCustomPrompt}
            onNewChat={onNewChat}
          />
          <div className="gutter" onMouseDown={startDrag} />
          <PreviewPanel
            files={project.files} t={t}
            device={device} setDevice={setDevice}
            view={view} setView={setView}
            logs={logs} clearLogs={() => setLogs([])}
            iframeKey={iframeKey}
            onReload={reloadIframe}
            onOpenExternal={openExternal}
            selectMode={selectMode} setSelectMode={(v) => { setSelectMode(v); if (!v) setSelected(null); }}
            overrides={project.overrides || {}}
            setOverrides={(o) => setProject((p) => ({ ...p, overrides: o }))}
            selected={selected} setSelected={setSelected}
          />
        </div>
      </div>
      <StatusBar t={t} model={model} status={busy ? "generating" : "ready"} busy={busy} files={project.files} />
      <ToastStack toasts={toasts} />
      {showDeploy && (
        <DeployModal t={t} language={language} project={project} onClose={() => setShowDeploy(false)}
          onConnectGitHub={() => setShowOAuth(true)} />
      )}
      {showOAuth && (
        <GitHubOAuthModal
          t={t} language={language}
          onClose={() => setShowOAuth(false)}
          onConnected={(s) => {
            toast({ kind: "success", title: language === "ja" ? "GitHubと接続しました" : "Signed in to GitHub", msg: "@" + s.user.login });
          }}
        />
      )}
      {ghConnecting && <GhConnecting language={language} />}
    </div>
  );
}

function PromptsPanel({ language, layers, skillsAvail, skillsEnabled, onSave, onToggleSkill, onClose }) {
  const ja = language === "ja";
  const [app, setApp] = useState(layers.app || "");
  const [glob, setGlob] = useState(layers.global || "");
  const [proj, setProj] = useState(layers.project || "");
  const [showApp, setShowApp] = useState(false);
  const [q, setQ] = useState("");
  // re-sync when the active project / backend values change
  useEffect(() => { setApp(layers.app || ""); setGlob(layers.global || ""); setProj(layers.project || ""); },
    [layers.app, layers.global, layers.project]);

  const ta = { width: "100%", minHeight: 70, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 10px", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, marginBottom: 4 };
  const lab = { display: "block", fontSize: 10, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: ".06em", margin: "10px 0 4px" };
  const filtered = skillsAvail.filter((s) => !q || s.name.includes(q) || (s.desc || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="files-panel">
      <div className="hp-head">
        <span className="hp-title">{ja ? "プロンプト & スキル" : "Prompts & Skills"}</span>
        <button className="fp-btn small" onClick={onClose} title="close"><Icon name="close" size={12} /></button>
      </div>
      <div className="fp-body" style={{ padding: "10px 12px" }}>
        <label style={lab}>{ja ? "プロジェクト全体（共通）" : "Global (all projects)"}</label>
        <textarea style={ta} value={glob} onChange={(e) => setGlob(e.target.value)} placeholder={ja ? "全プロジェクト共通の方針…" : "Shared across all projects…"} />

        <label style={lab}>{ja ? "このプロジェクト" : "This project"}</label>
        <textarea style={ta} value={proj} onChange={(e) => setProj(e.target.value)} placeholder={ja ? "このプロジェクト固有の指示…" : "Instructions for this project…"} />

        <button className="fp-btn ghost" style={{ marginTop: 6 }} onClick={() => setShowApp((s) => !s)}>
          {showApp ? "▾ " : "▸ "}{ja ? "アプリ既定（高度）" : "App default (advanced)"}
        </button>
        {showApp && (
          <>
            <textarea style={ta} value={app} onChange={(e) => setApp(e.target.value)} placeholder={layers.defaultApp} />
            <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>{ja ? "空欄なら既定を使用。" : "Blank = use the built-in default."}</div>
          </>
        )}

        <button className="fp-btn primary" style={{ marginTop: 10, width: "100%" }} onClick={() => onSave({ app, global: glob, project: proj })}>
          {ja ? "プロンプトを保存" : "Save prompts"}
        </button>

        <label style={lab}>{ja ? `スキル取込（${skillsEnabled.length} / ${skillsAvail.length}）` : `Skills (${skillsEnabled.length} / ${skillsAvail.length})`}</label>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder={ja ? "スキルを検索…" : "Search skills…"}
          style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, marginBottom: 6 }}
        />
        <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4 }}>
          {filtered.length === 0 && <div className="fp-empty">{ja ? "該当なし" : "No matches"}</div>}
          {filtered.map((s) => {
            const on = skillsEnabled.includes(s.name);
            return (
              <label key={s.name} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, padding: "7px 10px", borderBottom: "1px solid var(--border)", cursor: "pointer", alignItems: "start" }}>
                <input type="checkbox" checked={on} onChange={() => onToggleSkill(s.name)} style={{ marginTop: 2 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, color: on ? "var(--accent)" : "var(--fg)", fontFamily: "var(--font-mono)" }}>{s.name}</span>
                  {s.desc && <span style={{ display: "block", fontSize: 10, color: "var(--fg-muted)", lineHeight: 1.4, marginTop: 2 }}>{s.desc}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectsPanel({ language, projects, active, onOpen, onCreate, onClose }) {
  const [name, setName] = useState("");
  function submit() { const v = name.trim(); if (!v) return; onCreate(v); setName(""); }
  return (
    <div className="files-panel">
      <div className="hp-head">
        <span className="hp-title">{language === "ja" ? "プロジェクト" : "Projects"}</span>
        <button className="fp-btn small" onClick={onClose} title="close"><Icon name="close" size={12} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={language === "ja" ? "新規プロジェクト名" : "New project name"}
          style={{ flex: 1, minWidth: 0, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <button className="fp-btn primary" onClick={submit}>{language === "ja" ? "作成" : "New"}</button>
      </div>
      <div className="fp-body">
        <ul className="fp-list">
          {projects.length === 0 && <li className="fp-empty">{language === "ja" ? "プロジェクトがありません" : "No projects yet"}</li>}
          {projects.map((p) => (
            <li
              key={p.name}
              className="fp-row"
              onClick={() => onOpen(p.name)}
              style={p.name === active ? { borderLeft: "2px solid var(--accent)", background: "var(--accent-soft)" } : null}
            >
              <span className="fp-row-icon"><Icon name="folder" size={14} /></span>
              <span className="fp-row-name">{p.name}{p.name === active && <span className="vis">active</span>}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GhConnecting({ language }) {
  return (
    <div className="modal-backdrop">
      <div className="oauth-body oauth-loading" style={{ background: "var(--bg-1)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "28px 36px" }}>
        <div className="oauth-spinner" />
        <div className="oauth-loading-text">
          {language === "ja" ? "GitHubと接続しています…" : "Connecting to GitHub…"}
        </div>
        <div className="oauth-loading-sub">
          {language === "ja" ? "トークンを交換中" : "Exchanging token"}
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + (t.kind || "")}>
          <div className="t-title">{t.title}</div>
          {t.msg && <div className="t-msg">{t.msg}</div>}
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
