import { useI18n, type TKey } from '../app/i18n'
import { HINT } from './chessDemo'

const REFRESH_PATH =
  'M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.33,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z'

export function HintConsole({
  level,
  onSelect,
  onRefresh,
}: {
  level: number
  onSelect: (lv: number) => void
  onRefresh: () => void
}) {
  const { t, lang } = useI18n()
  return (
    <div className="panel">
      <div className="phead">
        <h6>{t('hints_h')}</h6>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onRefresh}
          title={lang === 'ru' ? 'Следующая подсказка' : 'Next hint'}
        >
          <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
            <path d={REFRESH_PATH} />
          </svg>
        </button>
      </div>
      <div className="hint-box">
        <div className="hint-levels">
          {[1, 2, 3].map((lv) => (
            <button
              key={lv}
              type="button"
              className="hint-lv"
              aria-pressed={level === lv}
              onClick={() => onSelect(lv)}
            >
              <b>{t(`hint${lv}_t` as TKey)}</b>
              <small>{t(`hint${lv}_s` as TKey)}</small>
            </button>
          ))}
        </div>
        {level === 0 ? (
          <div className="hint-readout empty">{t('hint_empty')}</div>
        ) : (
          <div className="hint-readout">
            <span className="kicker">
              {t('hints_h')} · {level}/3
            </span>
            <b style={{ fontFamily: 'var(--font-heading)' }}>
              {HINT[lang][`l${level}` as 'l1' | 'l2' | 'l3'][0]}
            </b>
            <br />
            {HINT[lang][`l${level}` as 'l1' | 'l2' | 'l3'][1]}
          </div>
        )}
      </div>
    </div>
  )
}
