import { useI18n } from '../app/i18n'

export function MoveList() {
  const { t, lang } = useI18n()
  const empty = lang === 'ru' ? 'Сделайте первый ход' : 'Make the first move'
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="phead">
        <h6>{t('moves_h')}</h6>
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
            <tr>
              <td className="n">–</td>
              <td className="mv" colSpan={2} style={{ opacity: 0.5 }}>
                {empty}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
