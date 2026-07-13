/* Game screen: clocks, material, move list, status, three-level hints. */

const Game = {
  moves: [],        // [{w:'..', b:'..'}]
  capturedByW: [],  // black pieces white took (glyphs)
  capturedByB: [],
  clocks: { w: 600, b: 600 }, // seconds
  timer: null,
  running: false,

  render() {
    return `
    <div class="game">
      <div class="board-col">
        <div class="player" id="pl-opp">
          <div class="avatar">✳</div>
          <div class="who"><b>${APP.model ? APP.model.name : "Qwen2.5 14B"}</b><small data-i="opp">${t("opp")} · ELO ${APP.elo}</small></div>
          <div class="captured" id="cap-b"></div>
          <div class="clock" id="clk-b">10:00</div>
        </div>

        <div class="board-wrap pieces--${APP.pieceStyle}">
          <div class="board board--${APP.boardStyle}" id="board"></div>
        </div>

        <div class="player" id="pl-you">
          <div class="avatar" style="color:var(--color-accent)"><svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg></div>
          <div class="who"><b>${t("you")}</b><small>ELO 1280 · ${t("yoursub")}</small></div>
          <div class="captured" id="cap-w"></div>
          <div class="clock active" id="clk-w">10:00</div>
        </div>
      </div>

      <div class="side-col">
        <div class="status" id="status">
          <span class="turn-dot"></span>
          <span class="txt"><b id="st-title">${t("yourmove")}</b><small id="st-sub">${t("yoursub")}</small></span>
        </div>

        <div class="panel">
          <div class="phead"><h6>${t("hints_h")}</h6><button class="btn btn-icon" id="hint-refresh" title="${APP.lang === "ru" ? "Следующая подсказка" : "Next hint"}"><svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.33,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"/></svg></button></div>
          <div class="hint-box">
            <div class="hint-levels">
              <button class="hint-lv" data-lv="1"><b>${t("hint1_t")}</b><small>${t("hint1_s")}</small></button>
              <button class="hint-lv" data-lv="2"><b>${t("hint2_t")}</b><small>${t("hint2_s")}</small></button>
              <button class="hint-lv" data-lv="3"><b>${t("hint3_t")}</b><small>${t("hint3_s")}</small></button>
            </div>
            <div class="hint-readout empty" id="hint-out">${t("hint_empty")}</div>
          </div>
        </div>

        <div class="panel" style="flex:1">
          <div class="phead">
            <h6>${t("moves_h")}</h6>
            <button class="btn btn-ghost" id="btn-draw">${t("offerdraw")}</button>
            <button class="btn btn-secondary" id="btn-resign">${t("resign")}</button>
          </div>
          <div class="moves" id="moves"><table><tbody id="moves-body"></tbody></table></div>
        </div>
      </div>
    </div>`;
  },

  mount() {
    this.moves = []; this.capturedByW = []; this.capturedByB = [];
    this.clocks = { w: 600, b: 600 };
    Board.init(document.getElementById("board"));
    Board.onMove = (san, color, captured) => this.recordMove(san, color, captured);
    Board.onReplyDone = () => this.setStatus("w");
    this.renderMoves(); this.renderCaptured(); this.updateClocks();

    document.querySelectorAll(".hint-lv").forEach(btn => {
      btn.addEventListener("click", () => {
        const lv = +btn.dataset.lv;
        const active = Board.setHint(lv);
        document.querySelectorAll(".hint-lv").forEach(b => b.setAttribute("aria-pressed", (+b.dataset.lv === active).toString()));
        this.renderHint(active);
      });
    });
    const refresh = document.getElementById("hint-refresh");
    if (refresh) refresh.addEventListener("click", () => {
      const next = (Board.hintLevel % 3) + 1; // 0/3→1, 1→2, 2→3
      const active = Board.setHint(next);
      document.querySelectorAll(".hint-lv").forEach(b => b.setAttribute("aria-pressed", (+b.dataset.lv === active).toString()));
      this.renderHint(active);
      const ic = refresh.querySelector("svg");
      ic.style.transition = "none"; ic.style.transform = "rotate(0deg)";
      requestAnimationFrame(() => { ic.style.transition = "transform .5s cubic-bezier(.2,.8,.2,1)"; ic.style.transform = "rotate(360deg)"; });
    });
    document.getElementById("btn-resign").addEventListener("click", () => Router.go("history"));
    document.getElementById("btn-draw").addEventListener("click", () => this.setStatus("w"));
    this.startClock();
  },

  renderHint(level) {
    const out = document.getElementById("hint-out");
    if (!out) return;
    if (level === 0) { out.className = "hint-readout empty"; out.textContent = t("hint_off"); return; }
    const h = HINT[APP.lang]["l" + level];
    out.className = "hint-readout";
    out.innerHTML = `<span class="kicker">${t("hints_h")} · ${level}/3</span><b style="font-family:var(--font-heading)">${h[0]}</b><br>${h[1]}`;
  },

  recordMove(san, color, captured) {
    if (captured) {
      const g = GLYPH_FILLED[captured.type];
      if (color === "w") this.capturedByW.push({ g, color: captured.color }); else this.capturedByB.push({ g, color: captured.color });
    }
    if (color === "w") this.moves.push({ w: san, b: "" });
    else if (this.moves.length) this.moves[this.moves.length - 1].b = san;
    this.renderMoves(); this.renderCaptured();
    if (color === "w") this.setStatus("b");
  },

  renderMoves() {
    const body = document.getElementById("moves-body");
    if (!body) return;
    // seed with a couple of played moves for context
    let rows = "";
    const all = this.moves;
    all.forEach((m, i) => {
      const last = i === all.length - 1;
      rows += `<tr><td class="n">${i + 1}.</td><td class="mv ${last && !m.b ? "cur" : ""}">${m.w}</td><td class="mv ${last && m.b ? "cur" : ""}">${m.b || ""}</td></tr>`;
    });
    body.innerHTML = rows || `<tr><td class="n">–</td><td class="mv text-muted" colspan="2" style="opacity:.5">${APP.lang === "ru" ? "Сделайте первый ход" : "Make the first move"}</td></tr>`;
    const wrap = document.getElementById("moves");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  },

  renderCaptured() {
    const cw = document.getElementById("cap-w"), cb = document.getElementById("cap-b");
    if (!cw || !cb) return;
    const adv = Board.material ? Board.material() : 0;
    cw.innerHTML = this.capturedByW.map(x => `<span class="b">${x.g}</span>`).join("") + (adv > 0 ? `<span class="adv">+${adv}</span>` : "");
    cb.innerHTML = this.capturedByB.map(x => `<span class="w">${x.g}</span>`).join("") + (adv < 0 ? `<span class="adv">+${-adv}</span>` : "");
  },

  setStatus(turn) {
    const st = document.getElementById("status");
    const title = document.getElementById("st-title");
    const sub = document.getElementById("st-sub");
    if (!st) return;
    st.classList.toggle("theirs", turn === "b");
    if (turn === "b") { title.textContent = t("theirmove"); sub.textContent = t("theirsub"); }
    else { title.textContent = t("yourmove"); sub.textContent = t("yoursub"); }
    this.active = turn;
    document.getElementById("clk-w").classList.toggle("active", turn === "w");
    document.getElementById("clk-b").classList.toggle("active", turn === "b");
  },

  startClock() {
    this.active = "w";
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const side = this.active || "w";
      if (this.clocks[side] > 0) this.clocks[side]--;
      this.updateClocks();
    }, 1000);
  },
  stopClock() { clearInterval(this.timer); },

  updateClocks() {
    const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
    const w = document.getElementById("clk-w"), b = document.getElementById("clk-b");
    if (w) { w.textContent = fmt(this.clocks.w); w.classList.toggle("low", this.clocks.w < 30); }
    if (b) { b.textContent = fmt(this.clocks.b); b.classList.toggle("low", this.clocks.b < 30); }
  },
};
