/* Template gallery shown when there's no active project. */
window.TemplateGallery = function ({ t, language, onPick }) {
  const [cat, setCat] = React.useState("all");
  const cats = ["all", "blank", "landing", "dashboard", "form", "game", "tool"];
  const items = window.TEMPLATES.filter((tpl) => cat === "all" || tpl.cat === cat);
  return (
    <div className="gallery">
      <h1>{t("gallery_h")}</h1>
      <div className="sub">{t("gallery_sub")}</div>

      <div className="gallery-tabs">
        {cats.map((c) => (
          <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
            {t("cat_" + c)}
          </button>
        ))}
      </div>

      <div className="tpl-grid">
        {items.map((tpl) => (
          <div
            key={tpl.id}
            role="button" tabIndex={0}
            className={"tpl-card " + (tpl.id === "blank" ? "blank" : "")}
            onClick={() => onPick(tpl)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(tpl); }}
          >
            <div className="thumb" style={{ background: tpl.color }}>
              <div className="preview-mini">{tpl.icon}</div>
            </div>
            <div className="body">
              <div className="name">{language === "ja" ? tpl.name_ja : tpl.name_en}</div>
              <div className="desc">{language === "ja" ? tpl.desc_ja : tpl.desc_en}</div>
              <div className="tags">
                {tpl.tags.map((tg) => <span className="tag" key={tg}>{tg}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
