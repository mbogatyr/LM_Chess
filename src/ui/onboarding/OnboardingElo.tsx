import { useI18n } from '../app/i18n'
import { useAppState } from '../app/appState'
import { eloBand } from '../app/demoData'
import { Steps } from './Steps'

export function OnboardingElo({
  onBack,
  onStart,
}: {
  onBack: () => void
  onStart: () => void
}) {
  const { t, lang } = useI18n()
  const { elo, setElo } = useAppState()
  const band = eloBand(elo)
  const pct = ((elo - 500) / 1000) * 100

  return (
    <div className="onb">
      <div className="onb-card">
        <Steps active={3} />
        <h2>{t('elo_h')}</h2>
        <p className="lede">{t('elo_p')}</p>
        <div className="elo-head">
          <span className="elo-num">{elo}</span>
          <span className="elo-title">{band[lang][0]}</span>
        </div>
        <input
          type="range"
          className="slider"
          min={500}
          max={1500}
          step={50}
          value={elo}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => setElo(Number(e.target.value))}
        />
        <div className="elo-ticks">
          <span>500</span>
          <span>750</span>
          <span>1000</span>
          <span>1250</span>
          <span>1500</span>
        </div>
        <p className="elo-quote">{band[lang][1]}</p>
        <div className="onb-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t('elo_back')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onStart}>
            {t('elo_start')}
          </button>
        </div>
      </div>
    </div>
  )
}
