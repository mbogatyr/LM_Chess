import { useI18n } from '../app/i18n'

export function GamePlaceholder() {
  const { t } = useI18n()
  return (
    <div className="game" style={{ placeItems: 'center' }}>
      <div className="onb-card" style={{ textAlign: 'center' }}>
        <h2>NeuroChess</h2>
        <p className="lede">{t('theirsub')}</p>
      </div>
    </div>
  )
}
