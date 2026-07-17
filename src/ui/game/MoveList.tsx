import { useI18n } from '../app/i18n'

export function MoveList({
  history,
  onNewGame,
}: {
  history: string[]
  onNewGame: () => void
}) {
  const { t, lang } = useI18n()
  const empty = lang === 'ru' ? 'Сделайте первый ход' : 'Make the first move'
  const lastPly = history.length - 1
  const rows = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, wi: i, bi: i + 1 })
  }
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="phead">
        <h6>{t('moves_h')}</h6>
        <button type="button" className="btn btn-ghost" onClick={onNewGame}>
          {t('newgame')}
        </button>
        <button type="button" className="btn btn-ghost" disabled>
          {t('offerdraw')}
        </button>
        <button type="button" className="btn btn-secondary" disabled>
          {t('resign')}
        </button>
      </div>
      <div className="moves">
        <table>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="n">–</td>
                <td className="mv" colSpan={2} style={{ opacity: 0.5 }}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.n}>
                  <td className="n">{row.n}</td>
                  <td className={'mv' + (row.wi === lastPly ? ' cur' : '')}>
                    {history[row.wi]}
                  </td>
                  <td className={'mv' + (row.bi === lastPly ? ' cur' : '')}>
                    {history[row.bi] ?? ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
