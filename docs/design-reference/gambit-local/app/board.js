/* Board + pieces + interactions. Depends on globals from data.js, set by main.js:
   window.APP = { lang, boardStyle, pieceStyle, ... } and window.t(key). */

const FILES = ["a","b","c","d","e","f","g","h"];
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/* Unicode glyphs — used only for the compact captured-pieces strip */
const GLYPH_FILLED = { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" };
const VALUE = { p:1, n:3, b:3, r:5, q:9, k:0 };

/* Chunky illustrated piece silhouettes (viewBox 0 0 100 100).
   Shapes inherit `fill` from the .body group; the base disc is the .foot ellipse. */
/* Real piece artwork (uploaded SVGs, line-art styled by side via CSS vars) */
const PIECE_SVGS = {
  p: { vb: "0 0 237.73 292.27", inner: `<path class="cls-1" d="M118.86,7C97.37,7,80,23.33,80,43.49a35.13,35.13,0,0,0,7.59,21.71c-19,10.22-31.91,29.29-31.91,51.27,0,18.52,9.14,35,23.44,45.89C49.9,172,7,213,7,285.27H230.73c0-72.26-42.9-113.22-72.08-122.9,14.3-10.86,23.44-27.37,23.44-45.89,0-22-12.94-41.06-31.91-51.27a35.13,35.13,0,0,0,7.59-21.71C157.77,23.33,140.36,7,118.86,7Z"/>` },
  r: { vb: "0 0 296.93 328.37", inner: `<path class="cls-1" d="M7,321.37H289.93V289.93H7Z"/><path class="cls-1" d="M38.44,289.93V248H258.5v41.92Z"/><path class="cls-1" d="M28,59.39V7H69.87V28h52.39V7h52.39V28h52.39V7H269V59.39"/><path class="cls-2" d="M237.54,221.82,253.26,248H43.68l15.72-26.2"/><path class="cls-3" d="M237.54,90.83V217.51H59.39V90.83"/><path class="cls-2" d="M269,59.39,237.54,90.83H59.39L28,59.39"/><path class="cls-4" d="M28,59.39H269"/>` },
  n: { vb: "0 0 309.81 346.95", inner: `<path class="cls-1" d="M148.85,40.06c15.28,1.46,15.64.12,29,4.22C261,69.74,307,150.44,302.51,339.95h-241c0-94.31,124.8-68.11,103.84-220.06"/><path class="cls-2" d="M102.69,51.39c2.65-12.69,7.79-27.94,15-38.65,1.5-2.25,3.34-4.6,5.8-5.11S128,8.5,129.87,10c9.25,7.32,15.66,18.62,17.68,31.13"/><path class="cls-1" d="M174.86,157.33c-11.75,13.12-25.34,24.55-39.6,34.83-17.39,12.53-34.63,23.47-48.89,40.07a96.93,96.93,0,0,1-14.74,13.7c-3.74,2.76-12.24,4.6-16.83,2.17-3.63-1.93-9-6.56-12.07-9s-6.1-1.09-9.78-1c-7.75.17-7.84-.74-13.9-6.07-19-16.74-13-48.16.49-64.81,8.35-10.31,22.36-33.39,36.73-55.5,3.31-5.08,4.37-11.14,5.6-17,1.3-6.14,4.19-10.29,8.42-14.95,13.51-14.86,57-37.93,66.06-41.47,2.58-1,4.16-1.33,5.41-3.77a64.24,64.24,0,0,1,5-8c5.72-8,13-15.12,21.78-19.62,10.46.61,10.29,38.1,10.29,38.1"/><path class="cls-1" d="M39.88,236.64a101.51,101.51,0,0,0,17.2-25.56"/><path class="cls-3" d="M37.17,204.3a5.24,5.24,0,1,1-4.93-5.53A5.24,5.24,0,0,1,37.17,204.3Z"/><path class="cls-4" d="M102.86,99c-5.39,6.8-11.6,10.86-13.87,9.07s.26-8.77,5.65-15.57,11.6-10.86,13.87-9.07S108.25,92.18,102.86,99Z"/><path class="cls-5" d="M181.38,82.16s-3.68-2,3.12,1.44c26.37,13.44,89.89,56.25,81.94,232.22"/>` },
  b: { vb: "0 0 359.81 363.11", inner: `<path class="cls-1" d="M38.44,326.61c35.52-10.16,105.94,4.51,141.47-21,35.52,25.46,105.94,10.79,141.47,21a83,83,0,0,1,31.44,21c-7.13,10.16-17.29,10.37-31.44,5.24-35.52-10.16-105.94,4.82-141.47-10.48-35.52,15.3-105.94.31-141.47,10.48-14.19,5.13-24.34,4.93-31.44-5.24C21.19,327.24,38.44,326.61,38.44,326.61Z"/><path class="cls-1" d="M101.31,284.69c26.2,26.2,131,26.2,157.18,0,4.77-14.31.2-33.55-8.29-45.73a60.7,60.7,0,0,0-17.91-17.14c57.63-15.72,62.87-120.51-52.39-162.42-115.27,41.92-110,146.71-52.39,162.42-.77-.21-3.85,2.67-4.39,3.1a67.55,67.55,0,0,0-10,9.49C102.2,247.2,95.91,268.48,101.31,284.69Z"/><path class="cls-1" d="M206.1,33.2A26.2,26.2,0,1,1,179.9,7,26.2,26.2,0,0,1,206.1,33.2Z"/><path class="cls-2" d="M127.51,221.82H232.3m-131,41.92H258.5M179.9,111.79v52.39M153.71,138H206.1"/>` },
  q: { vb: "0 0 381.71 347.65", inner: `<path class="cls-1" d="M49.39,201.81c89.07-15.72,220.06-15.72,282.93,0l21-125.75L279.93,191.33V44.62L222.29,186.09,190.85,28.9,159.42,186.09,101.78,39.38V191.33L28.43,76.06Z"/><path class="cls-1" d="M49.39,201.81c0,21,15.72,21,26.2,41.92,10.48,15.72,10.48,10.48,5.24,36.68-15.72,10.48-10.48,52.39-10.48,52.39,68.11,10.48,172.9,10.48,241,0,0,0,5.24-41.92-10.48-52.39-5.24-26.2-5.24-21,5.24-36.68,10.48-21,26.2-21,26.2-41.92C243.25,186.09,138.46,186.09,49.39,201.81Z"/><path class="cls-2" d="M75.59,243.72c36.68-10.48,193.86-10.48,230.54,0"/><path class="cls-2" d="M80.83,280.4c62.87-10.48,157.18-10.48,220.06,0"/><path class="cls-2" d="M48.92,75.11a21,21,0,1,1-21-21A21,21,0,0,1,48.92,75.11Z"/><path class="cls-2" d="M211.81,28a21,21,0,1,1-21-21A21,21,0,0,1,211.81,28Z"/><path class="cls-2" d="M374.71,75.11a21,21,0,1,1-21-21A21,21,0,0,1,374.71,75.11Z"/><path class="cls-2" d="M122.74,38.44a21,21,0,1,1-21-21A21,21,0,0,1,122.74,38.44Z"/><path class="cls-2" d="M300.88,43.68a21,21,0,1,1-21-21A21,21,0,0,1,300.88,43.68Z"/>` },
  k: { vb: "0 0 384.66 388.26", inner: `<path class="cls-1" d="M192.67,85.17V22.48"/><polygon class="cls-1" points="193.37 132.5 190.37 132.5 177.2 127.33 177.2 70.89 154.58 70.73 147.18 63.28 147.18 48.19 155.71 39.61 177.2 39.48 177.2 21.17 187.37 7 197.37 7 208.54 21.17 208.54 39.67 229.96 40.13 238.56 47.9 238.56 64.13 228.02 70.89 208.54 71.54 208.54 127.33 196.37 132.5 193.37 132.5"/><path class="cls-1" d="M192.67,241.06s50.11-83.52,33.41-116.93c0,0-11.14-27.84-33.41-27.84s-33.41,27.84-33.41,27.84c-16.7,33.41,33.41,116.93,33.41,116.93"/><path class="cls-2" d="M70.18,352c61.25,39,172.61,39,233.85,0v-78S404.25,224,370.84,157.15c-44.54-72.38-150.33-39-178.17,44.54v0C153.69,118.17,47.9,84.76,14.5,157.15-18.91,224,70.18,268.51,70.18,268.51Z"/><path class="cls-2" d="M70.18,274.07c61.25-33.41,172.61-33.41,233.85,0"/><path class="cls-2" d="M70.18,313c61.25-33.41,172.61-33.41,233.85,0"/><path class="cls-2" d="M70.18,352c61.25-33.41,172.61-33.41,233.85,0"/>` },
};

function pieceSVG(piece) {
  const s = PIECE_SVGS[piece.type];
  return `<svg class="cp cp-${piece.type}" viewBox="${s.vb}" aria-hidden="true">${s.inner}</svg>`;
}
window.pieceSVG = pieceSVG;

function parseFEN(fen) {
  const rows = fen.split("/");
  const board = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { for (let i = 0; i < +ch; i++) row.push(null); }
      else row.push({ color: ch === ch.toUpperCase() ? "w" : "b", type: ch.toLowerCase() });
    }
    board.push(row);
  }
  return board; // board[rank0=8][file0=a]
}

/* square helpers: r,c are array indices (r0 = rank 8) */
const sqName = (r, c) => FILES[c] + (8 - r);
const nameToRC = (s) => [8 - (+s[1]), FILES.indexOf(s[0])];

/* Pre-authored legal moves for the demo (white to move). capture=true → ring. */
const MOVES = {
  b1: [["a3",0],["c3",0]],
  g1: [["f3",0],["h3",0]],
  a2: [["a3",0],["a4",0]],
  b2: [["b3",0],["b4",0]],
  c2: [["c3",0],["c4",0]],
  d2: [["d3",0],["d4",0]],
  e2: [["e3",0],["e4",0]],
  f2: [["f3",0],["f4",0]],
  g2: [["g3",0],["g4",0]],
  h2: [["h3",0],["h4",0]],
};

/* Opponent's canned replies keyed by the player's move (from-to). */
const REPLIES = {
  "e2e4": { from: "e7", to: "e5", cap: false, san: "e5" },
  "d2d4": { from: "d7", to: "d5", cap: false, san: "d5" },
  "c2c4": { from: "e7", to: "e5", cap: false, san: "e5" },
  "g1f3": { from: "b8", to: "c6", cap: false, san: "Nc6" },
  "b1c3": { from: "g8", to: "f6", cap: false, san: "Nf6" },
  "_default": { from: "g8", to: "f6", cap: false, san: "Nf6" },
};

const HINT = {
  piece: "e2",                    // level 1 — which piece to move
  from: "e2", to: "e4",           // level 3 — the move
  targets: ["e4", "d4"],
  ru: {
    l1: ["Ходите центральной пешкой", "Начните с пешки e2 — сразу боритесь за центр."],
    l2: ["Захват центра", "Идея: e4 занимает центр и открывает дороги ферзю и слону f1. Дальше — вывод коней и рокировка."],
    l3: ["e2 → e4", "Двиньте пешку на e4. Самый популярный первый ход — пространство и быстрое развитие."],
  },
  en: {
    l1: ["Move a centre pawn", "Start with the e2 pawn — fight for the centre right away."],
    l2: ["Grab the centre", "Idea: e4 takes the centre and opens lines for the queen and the f1 bishop. Then develop the knights and castle."],
    l3: ["e2 → e4", "Push the pawn to e4. The most popular first move — space and quick development."],
  },
};

/* ── Board state ────────────────────────────────────────────────────────── */
const Board = {
  el: null,
  state: null,
  selected: null,      // square name
  legal: [],           // [[sq,cap]]
  last: null,          // [from,to]
  hintLevel: 0,        // 0..3
  turn: "w",
  onMove: null,        // callback(san, color)

  init(el) {
    this.el = el;
    this.reset();
  },

  reset() {
    this.state = parseFEN(START_FEN);
    this.selected = null; this.legal = []; this.last = null;
    this.hintLevel = 0; this.turn = "w";
    this.render();
  },

  setStyles() {
    this.el.className = "board board--" + window.APP.boardStyle;
    // pieces palette lives on board-wrap parent
    const wrap = this.el.closest(".board-wrap");
    if (wrap) wrap.className = "board-wrap pieces--" + window.APP.pieceStyle;
  },

  render() {
    this.setStyles();
    const b = this.state;
    let html = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const name = sqName(r, c);
        const light = (r + c) % 2 === 0;
        const classes = ["sq", light ? "light" : "dark"];
        if (this.last && (this.last[0] === name || this.last[1] === name)) classes.push("last");
        if (this.selected === name) classes.push("sel");
        const legal = this.legal.find(m => m[0] === name);
        if (legal) classes.push("legal");
        // hints
        if (this.hintLevel >= 1 && name === HINT.piece) classes.push("hint1");
        if (this.hintLevel === 2 && HINT.targets.includes(name)) classes.push("hint-target");

        let inner = "";
        if (c === 0) inner += `<span class="coord rank">${8 - r}</span>`;
        if (r === 7) inner += `<span class="coord file">${FILES[c]}</span>`;
        if (legal) inner += `<span class="marker ${legal[1] ? "ring" : "dot"}"></span>`;
        const p = b[r][c];
        if (p) {
          const grab = p.color === this.turn ? " grab" : "";
          inner += `<span class="piece ${p.color}${grab}" data-sq="${name}">${pieceSVG(p)}</span>`;
        }
        html += `<div class="${classes.join(" ")}" data-sq="${name}">${inner}</div>`;
      }
    }
    this.el.innerHTML = html;
    this.renderArrows();
    this.bind();
  },

  renderArrows() {
    const wrap = this.el.closest(".board-wrap");
    let svg = wrap.querySelector(".arrows");
    if (svg) svg.remove();
    if (this.hintLevel < 3) return;
    const [fr, fc] = nameToRC(HINT.from);
    const [tr, tc] = nameToRC(HINT.to);
    const u = 12.5; // percent per square (100/8)
    const cx = (c) => (c + 0.5) * u, cy = (r) => (r + 0.5) * u;
    const x1 = cx(fc), y1 = cy(fr), x2 = cx(tc), y2 = cy(tr);
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "arrows");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    const acc = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
    // shorten so head sits inside target
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const ex = x2 - (dx / len) * 4.5, ey = y2 - (dy / len) * 4.5;
    svg.innerHTML =
      `<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
        <polygon points="0,0 4,2 0,4" fill="${acc}"/></marker></defs>
      <path d="M${x1},${y1} L${ex},${ey}" stroke="${acc}" stroke-width="2.4" fill="none"
        stroke-linecap="round" marker-end="url(#ah)" style="filter:drop-shadow(0 0 3px ${acc})"/>`;
    wrap.appendChild(svg);
  },

  bind() {
    this.el.querySelectorAll(".sq").forEach(sq => {
      sq.addEventListener("click", () => this.onSquareClick(sq.dataset.sq));
    });
    this.el.querySelectorAll(".piece.grab").forEach(p => this.attachDrag(p));
  },

  onSquareClick(name) {
    // clicking a legal target completes a move
    if (this.selected && this.legal.some(m => m[0] === name)) {
      this.doMove(this.selected, name);
      return;
    }
    const [r, c] = nameToRC(name);
    const p = this.state[r][c];
    if (p && p.color === this.turn) this.select(name);
    else this.clearSelection();
  },

  select(name) {
    this.selected = name;
    this.legal = MOVES[name] ? MOVES[name].slice() : [];
    this.render();
  },
  clearSelection() {
    this.selected = null; this.legal = [];
    this.render();
  },

  attachDrag(pieceEl) {
    pieceEl.addEventListener("pointerdown", (e) => {
      if (this.turn !== "w") return;
      e.preventDefault();
      const name = pieceEl.dataset.sq;
      this.select(name);
      const el = this.el.querySelector(`.piece[data-sq="${name}"]`);
      if (!el) return;
      const boardRect = this.el.getBoundingClientRect();
      el.classList.add("dragging");
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = ev.clientX - boardRect.left, y = ev.clientY - boardRect.top;
        const cell = boardRect.width / 8;
        const [sr, sc] = nameToRC(name);
        const dx = x - (sc + 0.5) * cell, dy = y - (sr + 0.5) * cell;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
      };
      const up = (ev) => {
        el.releasePointerCapture(e.pointerId);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        const x = ev.clientX - boardRect.left, y = ev.clientY - boardRect.top;
        const cell = boardRect.width / 8;
        const c = Math.floor(x / cell), r = Math.floor(y / cell);
        el.classList.remove("dragging");
        el.style.transform = "";
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const target = sqName(r, c);
          if (this.legal.some(m => m[0] === target)) { this.doMove(name, target); return; }
        }
        this.render();
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    });
  },

  doMove(from, to, silent) {
    const [fr, fc] = nameToRC(from), [tr, tc] = nameToRC(to);
    const piece = this.state[fr][fc];
    const captured = this.state[tr][tc];
    const cap = !!captured;
    this.state[tr][tc] = piece;
    this.state[fr][fc] = null;
    this.last = [from, to];
    this.selected = null; this.legal = [];
    this.hintLevel = 0;
    const mover = piece.color;
    this.turn = mover === "w" ? "b" : "w";
    const san = toSan(piece, to, cap);
    this.render();
    this.animateTo(from, to);
    if (this.onMove) this.onMove(san, mover, captured);
    if (!silent && mover === "w") {
      // opponent reply
      setTimeout(() => this.opponentReply(from, to), 950);
    }
  },

  opponentReply(pFrom, pTo) {
    const key = pFrom + pTo;
    const rep = REPLIES[key] || REPLIES._default;
    const [fr, fc] = nameToRC(rep.from);
    if (!this.state[fr][fc]) { this.turn = "w"; this.render(); if (this.onReplyDone) this.onReplyDone(); return; }
    const [tr, tc] = nameToRC(rep.to);
    const captured = this.state[tr][tc];
    const piece = this.state[fr][fc];
    this.state[tr][tc] = piece; this.state[fr][fc] = null;
    this.last = [rep.from, rep.to];
    this.turn = "w";
    this.render();
    this.animateTo(rep.from, rep.to);
    if (this.onMove) this.onMove(rep.san, "b", captured);
    if (this.onReplyDone) this.onReplyDone();
  },

  animateTo(from, to) {
    const el = this.el.querySelector(`.piece[data-sq="${to}"]`);
    if (!el) return;
    const [fr, fc] = nameToRC(from), [tr, tc] = nameToRC(to);
    const cell = this.el.getBoundingClientRect().width / 8;
    const dx = (fc - tc) * cell, dy = (fr - tr) * cell;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "";
      el.style.transform = "";
    });
  },

  setHint(level) {
    this.hintLevel = (this.hintLevel === level) ? 0 : level;
    // when hinting the piece, also pre-select so the player sees targets on level 3
    this.selected = null; this.legal = [];
    if (this.hintLevel === 3) { this.selected = HINT.piece; this.legal = MOVES[HINT.piece].slice(); }
    this.render();
    return this.hintLevel;
  },

  material() {
    let w = 0, bl = 0;
    for (const row of this.state) for (const p of row) if (p) { (p.color === "w" ? (w += VALUE[p.type]) : (bl += VALUE[p.type])); }
    return w - bl;
  },
};

function toSan(piece, to, cap) {
  if (piece.type === "p") return (cap ? to[0] + "×" : "") + to;
  const L = { k:"K", q:"Q", r:"R", b:"B", n:"N" }[piece.type];
  return L + (cap ? "×" : "") + to;
}
