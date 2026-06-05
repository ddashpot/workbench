/* Small icon set as inline SVG (JetBrains line-icon style). */
window.Icon = function ({ name, size = 16 }) {
  const paths = {
    play:   <path d="M5 3 L12 8 L5 13 Z" fill="currentColor"/>,
    stop:   <rect x="4" y="4" width="8" height="8" fill="currentColor"/>,
    refresh:<path d="M3 8 a5 5 0 1 1 1.5 3.5 M3 8 V4 M3 8 H7" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    chat:   <path d="M2 4h12v7H6l-3 3V4z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
    code:   <path d="M5 5L2 8l3 3 M11 5l3 3-3 3 M9 3L7 13" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    eye:    <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></g>,
    desktop: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="1.5" y="2.5" width="13" height="9" rx="1"/><path d="M5 14h6 M8 11.5v2.5"/></g>,
    tablet:  <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="3" y="1.5" width="10" height="13" rx="1.5"/></g>,
    mobile:  <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><circle cx="8" cy="12.5" r="0.5" fill="currentColor"/></g>,
    paperclip: <path d="M11 5L6 10a2 2 0 0 0 2.8 2.8L13 8a3.5 3.5 0 0 0-5-5L3 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    image: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1"/><circle cx="6" cy="6.5" r="1"/><path d="M2.5 12 6 8.5l3 3 2-2 2.5 2.5"/></g>,
    send: <path d="M2 8L14 2L10 14L8 9L2 8z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
    chevron: <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    close: <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
    history: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M2.5 7.5a5.5 5.5 0 1 0 1.5-4M2.5 3v4h4"/><path d="M8 5v3l2 2" strokeLinecap="round"/></g>,
    template: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/><rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/></g>,
    components: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="3.5" r="2"/><circle cx="3.5" cy="11" r="2"/><circle cx="12.5" cy="11" r="2"/><path d="M6.5 5.5L4.5 9.5 M9.5 5.5L11.5 9.5 M5.5 11h5"/></g>,
    settings: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2 M8 12.5v2 M1.5 8h2 M12.5 8h2 M3.4 3.4l1.4 1.4 M11.2 11.2l1.4 1.4 M3.4 12.6l1.4-1.4 M11.2 4.8l1.4-1.4"/></g>,
    branch: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="8" r="1.5"/><path d="M4 4.5v7 M4 8h6.5"/></g>,
    edit: <path d="M11 2L14 5L5 14L2 14L2 11Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
    copy: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M3 11V3a1 1 0 0 1 1-1h7"/></g>,
    sparkle: <path d="M8 1.5 L9 6 L13.5 7 L9 8 L8 12.5 L7 8 L2.5 7 L7 6 Z" fill="currentColor"/>,
    check: <path d="M3 8 L7 12 L13 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    download: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M8 2v9 M4 7l4 4 4-4"/><path d="M2 13.5h12"/></g>,
    share: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="3.5" r="1.8"/><circle cx="12" cy="12.5" r="1.8"/><path d="M5.5 7L10.5 4.5 M5.5 9L10.5 11.5"/></g>,
    plus: <path d="M8 3v10 M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
    bug: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="4" y="5" width="8" height="8" rx="3"/><path d="M2 7h2 M2 11h2 M12 7h2 M12 11h2 M6 4.5 L5 2.5 M10 4.5 L11 2.5 M8 5v8"/></g>,
    expand: <path d="M2 6V2h4 M14 6V2h-4 M2 10v4h4 M14 10v4h-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    folder: <path d="M1.5 4a1 1 0 0 1 1-1h4l1 1.5h5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4z" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
    pointer: <path d="M3 2 L12 7 L8 8 L11 13 L9 14 L6 9 L3 11 Z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {paths[name] || <circle cx="8" cy="8" r="2" fill="currentColor"/>}
    </svg>
  );
};

/* Tiny non-collision text token highlighter for code blocks in chat. */
window.highlight = function (code, lang) {
  const safe = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = safe(code);

  if (lang === "html") {
    html = html
      .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)/g, '$1<span class="tk-tag">$2</span>')
      .replace(/([a-zA-Z-]+)=(&quot;[^&]*?&quot;|"[^"]*?")/g, '<span class="tk-attr">$1</span>=<span class="tk-str">$2</span>')
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tk-com">$1</span>');
  } else if (lang === "css") {
    html = html
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tk-com">$1</span>')
      .replace(/^([.#][\w-]+|@[\w-]+|[a-zA-Z]+)(?=\s*[{,:])/gm, '<span class="tk-tag">$1</span>')
      .replace(/([\w-]+)(\s*:)/g, '<span class="tk-prop">$1</span>$2')
      .replace(/("[^"]*"|'[^']*')/g, '<span class="tk-str">$1</span>');
  } else if (lang === "js" || lang === "javascript") {
    html = html
      .replace(/(\/\/[^\n]*)/g, '<span class="tk-com">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tk-com">$1</span>')
      .replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`)/g, '<span class="tk-str">$1</span>')
      .replace(/\b(const|let|var|function|return|if|else|for|while|do|class|new|this|=&gt;|async|await|import|export|from|default|try|catch|throw|true|false|null|undefined)\b/g, '<span class="tk-kw">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="tk-num">$1</span>');
  }
  return html;
};
