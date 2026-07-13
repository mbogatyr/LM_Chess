/* Onboarding: connect → models → confirm → ELO. Each screen renders into #screen-onb. */

function steps(active) {
  const keys = ["step_connect", "step_model", "step_elo"];
  return `<div class="onb-steps">${keys.map((k, i) =>
    `<i class="${i < active ? "on" : ""}"></i>`).join("")} <span>${t(keys[active - 1])} · ${active}/3</span></div>`;
}

const Onboarding = {
  connectOk: false,

  connect() {
    return `<div class="onb"><div class="onb-bg" id="onb-bg"></div>
      <div class="onb-card">
        <div class="onb-brand"><div><b>NeuroChess</b><small>LLM Powered Strategy</small></div></div>
        ${steps(1)}
        <h2>${t("connect_h")}</h2>
        <p class="lede">${t("connect_p")}</p>
        <div class="field"><label>${t("connect_url")}</label>
          <input class="input" id="lm-url" value="http://localhost:1234" spellcheck="false"></div>
        <div id="conn-state"></div>
        <div class="onb-actions">
          <button class="btn btn-primary" id="btn-check">${t("connect_check")}</button>
        </div>
        <p class="foot-note">${t("connect_hint")}</p>
      </div></div>`;
  },

  mountConnect() {
    this.paintBg();
    const btn = document.getElementById("btn-check");
    const state = document.getElementById("conn-state");
    btn.addEventListener("click", () => {
      if (this.connectOk) { Router.go("onb-models"); return; }
      state.innerHTML = `<div class="pill"><span class="spinner"></span>${t("connect_checking")}</div>`;
      btn.disabled = true;
      setTimeout(() => {
        this.connectOk = true;
        APP.connected = true;
        state.innerHTML = `<div class="pill"><span class="live"></span>${t("connect_ok")}</div>`;
        btn.disabled = false;
        btn.textContent = t("connect_next");
        Chrome.refreshPill();
      }, 1400);
    });
  },

  models() {
    return `<div class="onb"><div class="onb-bg" id="onb-bg"></div>
      <div class="onb-card" style="width:min(600px,100%)">
        ${steps(2)}
        <h2>${t("model_h")}</h2>
        <p class="lede">${t("model_p")}</p>
        <div class="model-list" id="model-list"></div>
      </div></div>`;
  },

  mountModels() {
    this.paintBg();
    this.renderModelList();
  },

  renderModelList() {
    const list = document.getElementById("model-list");
    if (!list) return;
    list.innerHTML = MODELS.map(m => `
      <div class="model-row ${APP.model && APP.model.id === m.id ? "sel" : ""}" data-id="${m.id}">
        <div class="mi">
          <b>${m.name}</b>
          <div class="meta"><span>${t("model_ram")} ${m.ram}</span><span>${t("model_ctx")} ${m.ctx}</span><span>${t("model_q")} ${m.q}</span></div>
          <div class="bar" data-bar hidden><i></i></div>
        </div>
        <div class="acts">
          ${m.loaded
            ? `<span class="tag tag-accent">${t("loaded")}</span><button class="btn btn-primary" data-use>${t("use")}</button>`
            : `<button class="btn btn-secondary" data-load>${t("load")}</button>`}
        </div>
      </div>`).join("");

    list.querySelectorAll(".model-row").forEach(row => {
      const id = row.dataset.id;
      const model = MODELS.find(m => m.id === id);
      const loadBtn = row.querySelector("[data-load]");
      const useBtn = row.querySelector("[data-use]");
      if (loadBtn) loadBtn.addEventListener("click", () => this.loadModel(row, model, loadBtn));
      if (useBtn) useBtn.addEventListener("click", () => { APP.model = model; Router.go("onb-elo"); });
    });
  },

  loadModel(row, model, btn) {
    const bar = row.querySelector("[data-bar]");
    const fill = bar.querySelector("i");
    bar.hidden = false;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${t("loading")}`;
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 22 + 8;
      fill.style.width = Math.min(p, 100) + "%";
      if (p >= 100) {
        clearInterval(iv);
        model.loaded = true;
        setTimeout(() => this.renderModelList(), 260);
      }
    }, 180);
  },

  confirm() {
    const m = APP.model || MODELS[0];
    return `<div class="onb"><div class="onb-bg" id="onb-bg"></div>
      <div class="onb-card">
        ${steps(3)}
        <h2>${t("confirm_h")}</h2>
        <p class="lede">${t("confirm_p")}</p>
        <div class="model-row sel" style="cursor:default">
          <div class="avatar" style="width:42px;height:42px;display:grid;place-items:center;border-radius:var(--radius-md);background:var(--color-bg);color:var(--color-accent);box-shadow:0 0 16px -4px var(--color-accent);font-size:20px">✳</div>
          <div class="mi">
            <b>${m.name}</b>
            <div class="meta"><span><span class="live" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--color-accent);box-shadow:0 0 8px var(--color-accent);vertical-align:middle;margin-right:5px"></span>${t("confirm_specs")}</span><span>${t("model_ram")} ${m.ram}</span><span>${t("model_ctx")} ${m.ctx}</span></div>
          </div>
        </div>
        <div class="onb-actions">
          <button class="btn btn-secondary" id="c-back">${t("confirm_back")}</button>
          <button class="btn btn-primary" id="c-go">${t("confirm_go")}</button>
        </div>
      </div></div>`;
  },

  mountConfirm() {
    this.paintBg();
    document.getElementById("c-back").addEventListener("click", () => Router.go("onb-models"));
    document.getElementById("c-go").addEventListener("click", () => Router.go("onb-elo"));
  },

  elo() {
    return `<div class="onb"><div class="onb-bg" id="onb-bg"></div>
      <div class="onb-card">
        ${steps(3)}
        <h2>${t("elo_h")}</h2>
        <p class="lede">${t("elo_p")}</p>
        <div class="elo-head"><span class="elo-num" id="elo-num">${APP.elo}</span>
          <span class="elo-title" id="elo-title"></span></div>
        <input type="range" class="slider" id="elo-slider" min="500" max="1500" step="50" value="${APP.elo}">
        <div class="elo-ticks"><span>500</span><span>750</span><span>1000</span><span>1250</span><span>1500</span></div>
        <p class="elo-quote" id="elo-quote"></p>
        <div class="onb-actions">
          <button class="btn btn-secondary" id="e-back">${t("elo_back")}</button>
          <button class="btn btn-primary" id="e-go">${t("elo_start")}</button>
        </div>
      </div></div>`;
  },

  mountElo() {
    this.paintBg();
    const slider = document.getElementById("elo-slider");
    const update = () => {
      const v = +slider.value;
      APP.elo = v;
      const band = eloBand(v);
      document.getElementById("elo-num").textContent = v;
      document.getElementById("elo-title").textContent = band[APP.lang][0];
      document.getElementById("elo-quote").textContent = band[APP.lang][1];
      const pct = ((v - 500) / 1000) * 100;
      slider.style.setProperty("--pct", pct + "%");
    };
    slider.addEventListener("input", update);
    update();
    document.getElementById("e-back").addEventListener("click", () => Router.go("onb-models"));
    document.getElementById("e-go").addEventListener("click", () => Router.go("game"));
  },

  paintBg() {
    // faint board texture behind the cards
    const bg = document.getElementById("onb-bg");
    if (!bg) return;
    const c = document.createElement("canvas");
    c.width = c.height = 400;
    const ctx = c.getContext("2d");
    const cell = 50;
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (r + col) % 2 ? "#1a1c28" : "#262a3a";
      ctx.fillRect(col * cell, r * cell, cell, cell);
    }
    bg.style.backgroundImage = `url(${c.toDataURL()})`;
  },
};
