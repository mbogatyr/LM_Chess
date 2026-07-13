import { useI18n } from '../app/i18n'
import type { useConnection } from '../useConnection'
import type { LMModel } from '../../llm/types'
import { Steps } from './Steps'

type UseConnection = ReturnType<typeof useConnection>

export function OnboardingModels({
  conn,
  onUse,
}: {
  conn: UseConnection
  onUse: () => void
}) {
  const { t } = useI18n()
  const { models, loadingModelId, error } = conn.state

  return (
    <div className="onb">
      <div className="onb-card" style={{ width: 'min(600px, 100%)' }}>
        <Steps active={2} />
        <h2>{t('model_h')}</h2>
        <p className="lede">{t('model_p')}</p>
        {error && <p role="alert">{error}</p>}
        <div className="model-list">
          {models.map((model: LMModel) => {
            const loaded = model.state === 'loaded'
            const loading = loadingModelId === model.id
            return (
              <div className="model-row" key={model.id}>
                <div className="mi">
                  <b>{model.id}</b>
                  <div className="meta">
                    <span>{model.type}</span>
                    {model.quantization && (
                      <span>
                        {t('model_q')} {model.quantization}
                      </span>
                    )}
                    {model.maxContextLength && (
                      <span>
                        {t('model_ctx')} {model.maxContextLength}
                      </span>
                    )}
                  </div>
                </div>
                <div className="acts">
                  {loaded ? (
                    <>
                      <span className="tag tag-accent">{t('loaded')}</span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          conn.use(model.id)
                          onUse()
                        }}
                      >
                        {t('use')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={loading}
                      onClick={() => conn.load(model.id)}
                    >
                      {loading ? (
                        <>
                          <span className="spinner" />
                          {t('loading')}
                        </>
                      ) : (
                        t('load')
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
