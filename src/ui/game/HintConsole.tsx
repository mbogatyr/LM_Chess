import { useI18n, type TKey } from '../app/i18n'
import type { PieceType } from '../../engine/types'
import type { Hint } from '../../llm/hint'
import type { HintErrorKind } from './useHint'
import type { HintLevel } from './chessDemo'

const REFRESH_PATH =
  'M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.33,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z'

const PIECE_KEY: Record<PieceType, TKey> = {
  p: 'hint_piece_p',
  n: 'hint_piece_n',
  b: 'hint_piece_b',
  r: 'hint_piece_r',
  q: 'hint_piece_q',
  k: 'hint_piece_k',
}

export function HintConsole({
  level,
  hint,
  loading,
  errorKind,
  onSelectLevel,
  onRefresh,
  disabled,
}: {
  level: HintLevel
  hint: Hint | null
  loading: boolean
  errorKind: HintErrorKind | null
  onSelectLevel: (lv: HintLevel) => void
  onRefresh: () => void
  disabled?: boolean
}) {
  const { t, lang } = useI18n()

  const renderReadout = () => {
    if (disabled)
      return <div className="hint-readout empty">{t('hint_empty')}</div>
    if (loading) return <div className="hint-readout">{t('hint_loading')}</div>
    if (errorKind)
      return (
        <div className="hint-readout">
          {errorKind === 'connection' ? t('hint_error_conn') : t('hint_error')}
        </div>
      )
    if (level === 0 || !hint)
      return <div className="hint-readout empty">{t('hint_empty')}</div>

    const body =
      level === 1
        ? `${t('hint_l1')} ${t(PIECE_KEY[hint.pieceType])}`
        : level === 2
          ? hint.idea || t('hint_idea_empty')
          : `${hint.from} → ${hint.to}`
    return (
      <div className="hint-readout">
        <span className="kicker">
          {t('hints_h')} · {level}/3
        </span>
        <b style={{ fontFamily: 'var(--font-heading)' }}>
          {t(`hint${level}_t`)}
        </b>
        <br />
        {body}
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="phead">
        <h6>{t('hints_h')}</h6>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onRefresh}
          disabled={disabled}
          title={lang === 'ru' ? 'Следующая подсказка' : 'Next hint'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d={REFRESH_PATH} />
          </svg>
        </button>
      </div>
      <div className="hint-box">
        <div className="hint-levels">
          {([1, 2, 3] as const satisfies readonly HintLevel[]).map((lv) => (
            <button
              key={lv}
              type="button"
              className="hint-lv"
              aria-pressed={level === lv}
              onClick={() => onSelectLevel(lv)}
              disabled={disabled}
            >
              <b>{t(`hint${lv}_t`)}</b>
              <small>{t(`hint${lv}_s`)}</small>
            </button>
          ))}
        </div>
        {renderReadout()}
      </div>
    </div>
  )
}
