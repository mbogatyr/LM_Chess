import { useMemo } from 'react'
import { useI18n } from '../app/i18n'
import { gameStats, loadGames } from './gameHistory'

export function HistoryScreen() {
  const { t, lang } = useI18n()
  const games = useMemo(() => loadGames(), [])
  const { played, winRate, streak, best } = gameStats(games)
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })
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
      {games.length === 0 ? (
        <div
          className="card elev-sm"
          style={{ padding: 'var(--space-6)', textAlign: 'center' }}
        >
          <p className="text-muted" style={{ margin: 0 }}>
            {t('lb_empty')}
          </p>
        </div>
      ) : (
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
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td className="text-muted">{fmtDate(g.endedAt)}</td>
                  <td>{g.opponent}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {g.elo}
                  </td>
                  <td
                    className="text-muted"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {Math.ceil(g.plies / 2)}
                  </td>
                  <td>
                    <span className={`res ${g.result}`}>{t(g.result)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
