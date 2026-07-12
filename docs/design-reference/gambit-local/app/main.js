/* App state, i18n binding, topbar chrome, router, appearance sheet. */

const STORE = "nocturne-chess";
const APP = Object.assign({
  lang: "ru",
  boardStyle: "mono",
  pieceStyle: "neon",
  elo: 1000,
  connected: false,
  onboarded: false,
  model: null,
}, JSON.parse(localStorage.getItem(STORE) || "{}"));
window.APP = APP;

function save() {
  const { lang, boardStyle, pieceStyle, elo } = APP;
  localStorage.setItem(STORE, JSON.stringify({ lang, boardStyle, pieceStyle, elo }));
}
function t(key) { return (I18N[APP.lang] && I18N[APP.lang][key]) || key; }
window.t = t;

/* ── Brand logo — a low-poly "neural network" knight in the accent hue ─── */
const LOGO_NODES = [[53,19],[45,25],[62,29],[42,35],[75,41],[59,43],[81,53],[67,52],[55,55],[45,50],[39,49],[51,67],[44,74],[60,71],[40,85],[54,86],[67,83]];
const LOGO_EDGES = [[0,1],[0,2],[1,3],[2,4],[2,5],[4,6],[5,7],[6,7],[5,8],[7,8],[3,10],[1,10],[3,5],[9,10],[8,9],[8,11],[9,11],[11,12],[11,13],[12,14],[12,15],[13,15],[13,16],[14,15],[15,16],[10,12],[0,3],[4,7],[8,13]];
function logoSVG() {
  const lines = LOGO_EDGES.map(([a, b]) => `<line x1="${LOGO_NODES[a][0]}" y1="${LOGO_NODES[a][1]}" x2="${LOGO_NODES[b][0]}" y2="${LOGO_NODES[b][1]}"/>`).join("");
  const dots = LOGO_NODES.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 2.6 : 1.7}"/>`).join("");
  return `<svg class="logo-mark" viewBox="0 0 100 100" aria-hidden="true"><g class="lg-lines">${lines}</g><g class="lg-dots">${dots}</g></svg>`;
}

/* ── Topbar chrome ──────────────────────────────────────────────────────── */
const Chrome = {
  render() {
    return `
      <div class="brand">
        <div class="brand-txt"><b>NeuroChess</b><span>${t("subtitle")}</span></div>
      </div>
      <div class="topbar-tabs">
        <button class="tab" data-tab="game">${t("tab_game")}</button>
        <button class="tab" data-tab="history">${t("tab_history")}</button>
      </div>
      <span class="pill ${APP.connected ? "" : "off"}" id="conn-pill">
        <span class="live"></span><span id="pill-txt">${APP.connected ? t("connected") : t("offline")}</span>
      </span>
      <button class="tab" id="btn-style">◧ ${t("styleBtn")}</button>
      <div class="lang">
        <button data-lang="ru" aria-pressed="${APP.lang === "ru"}">RU</button>
        <button data-lang="en" aria-pressed="${APP.lang === "en"}">EN</button>
      </div>`;
  },
  mount() {
    const bar = document.getElementById("topbar");
    bar.innerHTML = this.render();
    bar.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
      const tab = b.dataset.tab;
      if (tab === "game") Router.go(APP.onboarded ? "game" : "onb-connect");
      else Router.go("history");
    }));
    bar.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
      APP.lang = b.dataset.lang; save(); Chrome.mount(); Router.reload();
    }));
    document.getElementById("btn-style").addEventListener("click", () => Sheet.open());
    this.syncTabs(Router.current);
  },
  syncTabs(name) {
    document.querySelectorAll("#topbar [data-tab]").forEach(b => {
      const on = (b.dataset.tab === "game" && name && name.startsWith("game")) ||
                 (b.dataset.tab === "game" && name && name.startsWith("onb")) ||
                 (b.dataset.tab === "history" && name === "history");
      b.setAttribute("aria-current", on ? "true" : "false");
    });
  },
  refreshPill() {
    const pill = document.getElementById("conn-pill");
    const txt = document.getElementById("pill-txt");
    if (!pill) return;
    pill.classList.toggle("off", !APP.connected);
    txt.textContent = APP.connected ? t("connected") : t("offline");
  },
};

/* ── Router ─────────────────────────────────────────────────────────────── */
const Router = {
  current: null,
  go(name) {
    if (typeof Game !== "undefined" && Game.stopClock) Game.stopClock();
    const host = document.getElementById("screen-host");
    const map = {
      "onb-connect": [() => Onboarding.connect(), () => Onboarding.mountConnect()],
      "onb-models":  [() => Onboarding.models(),  () => Onboarding.mountModels()],
      "onb-confirm": [() => Onboarding.confirm(),  () => Onboarding.mountConfirm()],
      "onb-elo":     [() => Onboarding.elo(),      () => Onboarding.mountElo()],
      "game":        [() => Game.render(),         () => Game.mount()],
      "history":     [() => History.render(),      () => null],
    };
    const [view, mount] = map[name];
    host.innerHTML = `<div class="screen">${view()}</div>`;
    mount && mount();
    if (name === "game") APP.onboarded = true;
    this.current = name;
    Chrome.syncTabs(name);
  },
  reload() { if (this.current) this.go(this.current); },
};
window.Router = Router;
window.Chrome = Chrome;

/* ── Appearance sheet (board + piece variants) ──────────────────────────── */
const Sheet = {
  boards: ["mono", "contrast", "accent"],
  pieces: ["neon", "outline", "flat"],
  miniColors: {
    mono:     ["#262a3a", "#1a1c28"],
    contrast: ["#3a3f52", "#191b26"],
    accent:   ["color-mix(in srgb, var(--color-accent) 14%, #20222f)", "color-mix(in srgb, var(--color-accent) 6%, #14151f)"],
  },
  open() {
    const bd = document.getElementById("sheet-backdrop");
    bd.hidden = false;
    bd.innerHTML = `<div class="sheet">
      <h4 style="margin:0">${t("style_h")}</h4>
      <div><h6 style="color:var(--color-neutral-400);margin-bottom:var(--space-2)">${t("style_board")}</h6>
        <div class="opt-grid">${this.boards.map(b => this.boardOpt(b)).join("")}</div></div>
      <div><h6 style="color:var(--color-neutral-400);margin-bottom:var(--space-2)">${t("style_pieces")}</h6>
        <div class="opt-grid">${this.pieces.map(p => this.pieceOpt(p)).join("")}</div></div>
      <div class="dialog-actions"><button class="btn btn-primary" id="sheet-done">${t("done")}</button></div>
    </div>`;
    bd.querySelectorAll("[data-board]").forEach(o => o.addEventListener("click", () => { APP.boardStyle = o.dataset.board; save(); this.reopenAndApply(); }));
    bd.querySelectorAll("[data-piece]").forEach(o => o.addEventListener("click", () => { APP.pieceStyle = o.dataset.piece; save(); this.reopenAndApply(); }));
    document.getElementById("sheet-done").addEventListener("click", () => this.close());
    bd.addEventListener("click", (e) => { if (e.target === bd) this.close(); }, { once: true });
  },
  boardOpt(b) {
    const [l, d] = this.miniColors[b];
    let cells = "";
    for (let i = 0; i < 16; i++) { const light = (Math.floor(i / 4) + (i % 4)) % 2 === 0; cells += `<div style="background:${light ? l : d}"></div>`; }
    return `<button class="opt" data-board="${b}" aria-pressed="${APP.boardStyle === b}">
      <div class="mini-board">${cells}</div><small>${t("board_" + b)}</small></button>`;
  },
  pieceOpt(p) {
    const cell = (c, ty) => `<span style="position:relative;width:46px;height:46px;display:inline-block"><span class="piece ${c}">${pieceSVG({ color: c, type: ty })}</span></span>`;
    return `<button class="opt" data-piece="${p}" aria-pressed="${APP.pieceStyle === p}">
      <div class="pieces--${p}" style="display:flex;gap:6px;justify-content:center;align-items:center;padding:12px 0;background:#191c28;border-radius:var(--radius-sm);width:100%">
        ${cell("w", "n")}${cell("b", "q")}
      </div><small>${t("pieces_" + p)}</small></button>`;
  },
  reopenAndApply() {
    if (Router.current === "game" && Board.el) { Board.setStyles(); Board.render(); }
    this.open();
  },
  close() { document.getElementById("sheet-backdrop").hidden = true; },
};
window.Sheet = Sheet;

/* ── Boot ───────────────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  Chrome.mount();
  Router.go(APP.onboarded ? "game" : "onb-connect");
});
