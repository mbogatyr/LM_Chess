import { useEffect, useState } from 'react'
import { useI18n } from '../app/i18n'
import type { useConnection } from '../useConnection'
import { Steps } from './Steps'

type UseConnection = ReturnType<typeof useConnection>

export function OnboardingConnect({
  conn,
  onConnected,
}: {
  conn: UseConnection
  onConnected: () => void
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState(conn.state.baseUrl)
  const { phase, error } = conn.state

  // Auto-advance to model selection as soon as the server responds — the
  // models are already fetched by the time the phase reaches 'connected'.
  useEffect(() => {
    if (phase === 'connected') onConnected()
  }, [phase, onConnected])

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-brand">
          <div>
            <b>NeuroChess</b>
            <small>LLM Powered Strategy</small>
          </div>
        </div>
        <Steps active={1} />
        <h2>{t('connect_h')}</h2>
        <p className="lede">{t('connect_p')}</p>
        <div className="field">
          <label htmlFor="lm-url">{t('connect_url')}</label>
          <input
            id="lm-url"
            className="input"
            value={url}
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div>
          {phase === 'connecting' && (
            <div className="pill">
              <span className="spinner" />
              {t('connect_checking')}
            </div>
          )}
          {phase === 'error' && error && <p role="alert">{error}</p>}
        </div>
        <div className="onb-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={phase === 'connecting'}
            onClick={() => conn.connect(url)}
          >
            {t('connect_check')}
          </button>
        </div>
        <p className="foot-note">{t('connect_hint')}</p>
      </div>
    </div>
  )
}
