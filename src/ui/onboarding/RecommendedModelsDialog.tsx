import { useEffect } from 'react'
import { useI18n } from '../app/i18n'
import { recommendedModels } from './recommended'

export function RecommendedModelsDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="rec-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('rec_h')}
      onClick={onClose}
    >
      <div className="rec-card" onClick={(e) => e.stopPropagation()}>
        <h3>{t('rec_h')}</h3>
        <p className="lede">{t('rec_p')}</p>
        <ul className="rec-list">
          {recommendedModels.map((m) => (
            <li className="rec-row" key={m.rank}>
              <span className="rec-rank">№{m.rank}</span>
              <span className="model-star" aria-hidden="true">
                ★
              </span>
              <div>
                <b>{m.name}</b>
                <p>{m.comment[lang]}</p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('rec_close')}
        </button>
      </div>
    </div>
  )
}
