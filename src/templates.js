/* Starter templates. Each is a full HTML/CSS/JS bundle. */
window.TEMPLATES = [
  {
    id: "blank",
    name_ja: "空のアプリ",
    name_en: "Blank app",
    desc_ja: "HTML/CSS/JSの最小構成。",
    desc_en: "Minimal HTML/CSS/JS scaffold.",
    cat: "blank",
    tags: ["html", "css", "js"],
    icon: "✦",
    color: "linear-gradient(135deg,#2b2d30,#393b40)",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>App</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1>Hello, world.</h1>
    <p>Edit me via chat →</p>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      "styles.css": `body{
  margin:0; min-height:100vh;
  display:grid; place-items:center;
  font-family: -apple-system, system-ui, sans-serif;
  background:#fafafa; color:#111;
}
main{ text-align:center; }
h1{ font-size:48px; letter-spacing:-0.02em; margin:0 0 8px; }
p{ color:#666; }`,
      "app.js": `// JS goes here\nconsole.log("ready");`,
    },
  },
  {
    id: "todo",
    name_ja: "Todoアプリ",
    name_en: "Todo app",
    desc_ja: "追加・完了・削除ができるシンプルなTodo。",
    desc_en: "Add, complete, delete tasks. Local storage.",
    cat: "tool",
    tags: ["state", "localStorage"],
    icon: "✓",
    color: "linear-gradient(135deg,#4078e6,#21d789)",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>Todo</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <header>
      <h1>Todo</h1>
      <span id="count" class="count">0</span>
    </header>
    <form id="form">
      <input id="input" placeholder="新しいタスク…" autocomplete="off" />
      <button>追加</button>
    </form>
    <ul id="list"></ul>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
      "styles.css": `:root{ --accent:#4078e6; }
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#f5f5f7;color:#111;
  font-family:-apple-system,system-ui,sans-serif;
  display:grid;place-items:start center;padding:64px 16px}
main{width:100%;max-width:480px;background:#fff;border-radius:16px;
  padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
header{display:flex;align-items:center;gap:8px;margin-bottom:16px}
h1{margin:0;font-size:22px;letter-spacing:-.02em}
.count{margin-left:auto;background:#eef2ff;color:var(--accent);
  padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
form{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;padding:10px 12px;border:1px solid #e5e5e5;border-radius:8px;font:inherit}
input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
button{padding:10px 14px;background:var(--accent);color:#fff;border:0;border-radius:8px;
  font:inherit;font-weight:500;cursor:pointer}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
li{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px}
li:hover{background:#fafafa}
li input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent)}
li.done span{text-decoration:line-through;color:#999}
li span{flex:1}
li .del{background:transparent;color:#999;font-size:18px;padding:4px 8px}
li .del:hover{color:#e55765}`,
      "app.js": `const KEY = "todos.v1";
let todos = JSON.parse(localStorage.getItem(KEY) || "[]");

const $ = (id) => document.getElementById(id);
const form = $("form"), input = $("input"), list = $("list"), count = $("count");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t) return;
  todos.push({ id: Date.now(), text: t, done: false });
  input.value = ""; save(); render();
});

function save(){ localStorage.setItem(KEY, JSON.stringify(todos)); }

function render(){
  list.innerHTML = "";
  todos.forEach((t) => {
    const li = document.createElement("li");
    if (t.done) li.classList.add("done");
    li.innerHTML = \`<input type=checkbox \${t.done?"checked":""}>
      <span></span>
      <button class=del aria-label="delete">×</button>\`;
    li.querySelector("span").textContent = t.text;
    li.querySelector("input").onchange = () => { t.done = !t.done; save(); render(); };
    li.querySelector(".del").onclick = () => {
      todos = todos.filter((x) => x.id !== t.id); save(); render();
    };
    list.appendChild(li);
  });
  count.textContent = todos.length;
}
render();`,
    },
  },
  {
    id: "landing",
    name_ja: "ランディングページ",
    name_en: "Landing page",
    desc_ja: "ヒーロー、特徴、CTAの基本構成。",
    desc_en: "Hero, features, CTA. SaaS-style.",
    cat: "landing",
    tags: ["marketing"],
    icon: "▲",
    color: "linear-gradient(135deg,#ff318c,#fcf84a)",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Launch</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<nav>
  <div class="logo">◆ Launch</div>
  <ul><li>Product</li><li>Pricing</li><li>About</li></ul>
  <button class="cta">Get started</button>
</nav>
<header class="hero">
  <span class="badge">New · v2.0</span>
  <h1>Build, ship, repeat —<br/>without leaving your editor.</h1>
  <p>One canvas for design, code, and AI. Press tab. Watch it happen.</p>
  <div class="row">
    <button class="primary">Start free</button>
    <button class="ghost">See how it works →</button>
  </div>
</header>
<section class="features">
  <div class="f"><h3>Fast</h3><p>Stream code straight to your preview.</p></div>
  <div class="f"><h3>Focused</h3><p>No tabs, no context-switching.</p></div>
  <div class="f"><h3>Yours</h3><p>Export everything as plain HTML.</p></div>
</section>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,system-ui,sans-serif;color:#111;background:#fff}
nav{display:flex;align-items:center;gap:24px;padding:20px 48px;border-bottom:1px solid #f0f0f0}
nav .logo{font-weight:700;letter-spacing:-.02em}
nav ul{display:flex;gap:24px;list-style:none;margin:0 0 0 auto;padding:0;color:#666;font-size:14px}
nav .cta{padding:8px 14px;background:#111;color:#fff;border:0;border-radius:8px;font-weight:500;cursor:pointer}
.hero{padding:96px 48px 64px;max-width:920px;margin:0 auto;text-align:center}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;background:#f5f5f7;font-size:12px;color:#666;margin-bottom:24px}
.hero h1{font-size:64px;letter-spacing:-.03em;line-height:1.05;margin:0 0 16px}
.hero p{font-size:18px;color:#666;max-width:560px;margin:0 auto 32px}
.row{display:flex;gap:12px;justify-content:center}
button{font:inherit;cursor:pointer;padding:12px 20px;border-radius:10px;border:0;font-weight:500}
.primary{background:#111;color:#fff}
.ghost{background:transparent;color:#111}
.features{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:48px;max-width:920px;margin:0 auto}
.f{padding:24px;border:1px solid #f0f0f0;border-radius:12px}
.f h3{margin:0 0 8px;font-size:16px}
.f p{margin:0;color:#666;font-size:14px}`,
      "app.js": `document.querySelectorAll('button').forEach(b => {
  b.addEventListener('click', () => console.log('clicked', b.textContent));
});`,
    },
  },
  {
    id: "dashboard",
    name_ja: "ダッシュボード",
    name_en: "Analytics dashboard",
    desc_ja: "KPI、グラフ、テーブル付きの管理画面。",
    desc_en: "KPI cards, charts, table.",
    cat: "dashboard",
    tags: ["chart"],
    icon: "▤",
    color: "linear-gradient(135deg,#10a37f,#4078e6)",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Analytics</title>
<link rel="stylesheet" href="styles.css"></head>
<body>
<aside>
  <div class="brand">◆ ACME</div>
  <ul><li class="on">Overview</li><li>Sales</li><li>Users</li><li>Settings</li></ul>
</aside>
<main>
  <header><h1>Overview</h1><span>Last 30 days</span></header>
  <div class="kpis">
    <div class="kpi"><span>Revenue</span><b>$12,480</b><i class="up">+8.2%</i></div>
    <div class="kpi"><span>Users</span><b>3,210</b><i class="up">+12.4%</i></div>
    <div class="kpi"><span>Churn</span><b>2.1%</b><i class="dn">−0.3%</i></div>
    <div class="kpi"><span>MRR</span><b>$8,420</b><i class="up">+4.0%</i></div>
  </div>
  <section class="chart">
    <h3>Revenue</h3>
    <svg viewBox="0 0 600 200" preserveAspectRatio="none"><polyline id="ln"/></svg>
  </section>
</main>
<script src="app.js"></script>
</body></html>`,
      "styles.css": `*{box-sizing:border-box}
body{margin:0;display:grid;grid-template-columns:220px 1fr;font-family:-apple-system,system-ui,sans-serif;background:#f7f8fa;color:#111;min-height:100vh}
aside{background:#fff;border-right:1px solid #eee;padding:24px 16px}
.brand{font-weight:700;margin-bottom:24px}
aside ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
aside li{padding:8px 12px;border-radius:8px;font-size:14px;color:#555;cursor:pointer}
aside li.on{background:#eef2ff;color:#4078e6;font-weight:500}
main{padding:32px}
main header{display:flex;align-items:baseline;gap:12px;margin-bottom:24px}
h1{margin:0;font-size:24px;letter-spacing:-.02em}
header span{color:#888;font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.kpi{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}
.kpi span{color:#888;font-size:12px}
.kpi b{font-size:22px;letter-spacing:-.02em}
.kpi i{font-style:normal;font-size:12px;font-weight:500}
.kpi .up{color:#10a37f}.kpi .dn{color:#e55765}
.chart{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px}
.chart h3{margin:0 0 8px;font-size:14px;color:#555}
.chart svg{width:100%;height:200px}
#ln{fill:none;stroke:#4078e6;stroke-width:2}`,
      "app.js": `const pts = Array.from({length:30}, (_,i)=> 100 + Math.sin(i/3)*40 + Math.random()*30);
const ln = document.getElementById("ln");
ln.setAttribute("points", pts.map((y,i)=> \`\${(i/29)*600},\${200-y}\`).join(" "));`,
    },
  },
  {
    id: "form",
    name_ja: "サインアップフォーム",
    name_en: "Signup form",
    desc_ja: "バリデーション付きの新規登録。",
    desc_en: "Email/password form with validation.",
    cat: "form",
    tags: ["validation"],
    icon: "✎",
    color: "linear-gradient(135deg,#9876aa,#548af7)",
    files: {
      "index.html": `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign up</title>
<link rel="stylesheet" href="styles.css"></head>
<body>
<form id="f">
  <h1>Create account</h1>
  <p class="sub">14-day free trial. No card required.</p>
  <label>Email<input type="email" name="email" required /></label>
  <label>Password<input type="password" name="password" minlength="8" required />
    <small>Min 8 characters</small></label>
  <button>Continue →</button>
  <p class="alt">Already have an account? <a href="#">Sign in</a></p>
</form>
<script src="app.js"></script></body></html>`,
      "styles.css": `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fafafa;font-family:-apple-system,system-ui,sans-serif}
form{background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.05);width:100%;max-width:380px}
h1{margin:0 0 4px;font-size:24px;letter-spacing:-.02em}
.sub{margin:0 0 24px;color:#888;font-size:14px}
label{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;font-size:13px;color:#444;font-weight:500}
input{padding:10px 12px;border:1px solid #e5e5e5;border-radius:8px;font:inherit}
input:focus{outline:2px solid #4078e6;outline-offset:-1px;border-color:#4078e6}
small{color:#999;font-size:11px;font-weight:400}
button{width:100%;padding:12px;background:#111;color:#fff;border:0;border-radius:8px;font:inherit;font-weight:500;cursor:pointer;margin-top:8px}
.alt{margin:16px 0 0;text-align:center;font-size:13px;color:#888}
a{color:#4078e6;text-decoration:none}`,
      "app.js": `document.getElementById("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  console.log("submit", data);
  alert("Signed up: " + data.email);
});`,
    },
  },
  {
    id: "snake",
    name_ja: "スネークゲーム",
    name_en: "Snake game",
    desc_ja: "Canvas + 矢印キー操作の古典ゲーム。",
    desc_en: "Classic snake with arrow keys.",
    cat: "game",
    tags: ["canvas"],
    icon: "◉",
    color: "linear-gradient(135deg,#21d789,#fcf84a)",
    files: {
      "index.html": `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Snake</title>
<link rel="stylesheet" href="styles.css"></head>
<body>
<div class="hud"><span>Score: <b id="s">0</b></span><span>↑ ↓ ← → to move</span></div>
<canvas id="c" width="400" height="400"></canvas>
<script src="app.js"></script></body></html>`,
      "styles.css": `body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0f1115;color:#dfe1e5;font-family:-apple-system,system-ui,sans-serif}
.hud{display:flex;gap:24px;font-size:13px;color:#9da0a8}
.hud b{color:#fff}
canvas{background:#1a1c20;border-radius:8px;box-shadow:0 0 0 1px #2b2d30}`,
      "app.js": `const c = document.getElementById("c"), ctx = c.getContext("2d"), s = document.getElementById("s");
const N = 20, SZ = c.width / N;
let snake = [{x: 10, y: 10}], dir = {x: 1, y: 0}, food = spawnFood(), score = 0;
function spawnFood(){ return {x: Math.floor(Math.random()*N), y: Math.floor(Math.random()*N)}; }
addEventListener("keydown", (e) => {
  const m = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] }[e.key];
  if (m && (m[0] !== -dir.x || m[1] !== -dir.y)) dir = {x:m[0], y:m[1]};
});
function tick(){
  const h = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  if (h.x<0||h.y<0||h.x>=N||h.y>=N||snake.some(p=>p.x===h.x&&p.y===h.y)) {
    snake = [{x:10,y:10}]; dir={x:1,y:0}; score=0;
  } else {
    snake.unshift(h);
    if (h.x===food.x && h.y===food.y) { score++; food = spawnFood(); }
    else snake.pop();
  }
  s.textContent = score;
  ctx.fillStyle = "#1a1c20"; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = "#21d789"; snake.forEach(p=>ctx.fillRect(p.x*SZ+1, p.y*SZ+1, SZ-2, SZ-2));
  ctx.fillStyle = "#ff318c"; ctx.fillRect(food.x*SZ+2, food.y*SZ+2, SZ-4, SZ-4);
}
setInterval(tick, 100);`,
    },
  },
];

window.COMPONENT_LIB = [
  { name: "Button (primary)", code: `<button style="padding:10px 16px;background:#111;color:#fff;border:0;border-radius:8px;font-weight:500;cursor:pointer">Click me</button>` },
  { name: "Input", code: `<input placeholder="Type…" style="padding:10px 12px;border:1px solid #e5e5e5;border-radius:8px;font:inherit;width:100%" />` },
  { name: "Card", code: `<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
  <h3 style="margin:0 0 4px;font-size:16px">Card title</h3>
  <p style="margin:0;color:#666;font-size:14px">Card body text goes here.</p>
</div>` },
  { name: "Badge", code: `<span style="display:inline-block;padding:2px 8px;background:#eef2ff;color:#4078e6;border-radius:10px;font-size:12px;font-weight:500">New</span>` },
  { name: "Avatar", code: `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ff318c,#fcf84a);display:grid;place-items:center;color:#fff;font-weight:600">AB</div>` },
  { name: "Toggle", code: `<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
  <input type="checkbox" style="appearance:none;width:36px;height:20px;background:#ddd;border-radius:10px;position:relative;cursor:pointer" onchange="this.style.background=this.checked?'#4078e6':'#ddd'" />
  <span style="font-size:14px">Toggle</span>
</label>` },
];
