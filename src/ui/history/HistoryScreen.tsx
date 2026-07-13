import { useI18n } from '../app/i18n'
import { HISTORY, historyStats } from '../app/demoData'

export function HistoryScreen() {
  const { t, lang } = useI18n()
  const { played, winRate, streak, best } = historyStats(HISTORY)
  const ru = lang === 'ru'
  return (
    <div className="lb">
      <div>
        <h2 style={{ marginBottom: 4 }}>{t('lb_h')}</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          {t('lb_p')}
        </p>
      </div>
      <div className="lb-stats">
        <div className="card stat elev-sm">
          <span className="k">{t('st_played')}</span>
          <span className="v">{played}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_winrate')}</span>
          <span className="v pos">{winRate}%</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_streak')}</span>
          <span className="v">{streak > 0 ? `+${streak}` : '0'}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_best')}</span>
          <span className="v">{best}</span>
        </div>
      </div>
      <div
        className="card elev-sm"
        style={{ padding: 'var(--space-2) var(--space-4)' }}
      >
        <table className="table">
          <thead>
            <tr>
              <th>{t('col_date')}</th>
              <th>{t('col_opp')}</th>
              <th>{t('col_elo')}</th>
              <th>{t('col_len')}</th>
              <th>{t('col_res')}</th>
              <th>{t('col_open')}</th>
            </tr>
          </thead>
          <tbody>
            {HISTORY.map((h) => (
              <tr key={h.edate}>
                <td className="text-muted">{ru ? h.date : h.edate}</td>
                <td>{h.opp}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.elo}</td>
                <td
                  className="text-muted"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {h.len}
                </td>
                <td>
                  <span className={`res ${h.res}`}>{t(h.res)}</span>
                </td>
                <td className="text-muted">{ru ? h.open : h.eopen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
