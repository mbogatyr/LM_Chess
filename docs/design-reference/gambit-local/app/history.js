/* Leaderboard / match history. */

const History = {
  render() {
    const wins = HISTORY.filter(h => h.res === "win").length;
    const wr = Math.round((wins / HISTORY.length) * 100);
    let streak = 0; for (const h of HISTORY) { if (h.res === "win") streak++; else break; }
    const best = Math.max(...HISTORY.map(h => h.elo));
    const ru = APP.lang === "ru";

    const rows = HISTORY.map(h => `
      <tr>
        <td class="text-muted">${ru ? h.date : h.edate}</td>
        <td>${h.opp}</td>
        <td style="font-variant-numeric:tabular-nums">${h.elo}</td>
        <td class="text-muted" style="font-variant-numeric:tabular-nums">${h.len}</td>
        <td><span class="res ${h.res}">${t(h.res)}</span></td>
        <td class="text-muted">${ru ? h.open : h.eopen}</td>
      </tr>`).join("");

    return `<div class="lb">
      <div>
        <h2 style="margin-bottom:4px">${t("lb_h")}</h2>
        <p class="text-muted" style="margin:0">${t("lb_p")}</p>
      </div>
      <div class="lb-stats">
        <div class="card stat elev-sm"><span class="k">${t("st_played")}</span><span class="v">${HISTORY.length}</span></div>
        <div class="card stat elev-sm"><span class="k">${t("st_winrate")}</span><span class="v pos">${wr}%</span></div>
        <div class="card stat elev-sm"><span class="k">${t("st_streak")}</span><span class="v">${streak > 0 ? "+" + streak : "0"}</span></div>
        <div class="card stat elev-sm"><span class="k">${t("st_best")}</span><span class="v">${best}</span></div>
      </div>
      <div class="card elev-sm" style="padding:var(--space-2) var(--space-4)">
        <table class="table">
          <thead><tr>
            <th>${t("col_date")}</th><th>${t("col_opp")}</th><th>${t("col_elo")}</th>
            <th>${t("col_len")}</th><th>${t("col_res")}</th><th>${t("col_open")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },
};
