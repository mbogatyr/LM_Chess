import { useI18n } from '../app/i18n'
import type { Screen } from '../app/appState'

export function Topbar({
  connected,
  screen,
  onNavigate,
}: {
  connected: boolean
  screen: Screen
  onNavigate: (s: Screen) => void
}) {
  const { t, lang, setLang } = useI18n()
  const showTabs = screen === 'game' || screen === 'history'
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-txt">
          <b>NeuroChess</b>
          <span>{t('subtitle')}</span>
        </div>
      </div>
      {showTabs && (
        <div className="topbar-tabs">
          <button
            type="button"
            className="tab"
            data-tab="game"
            aria-current={screen === 'game'}
            onClick={() => onNavigate('game')}
          >
            {t('tab_game')}
          </button>
          <button
            type="button"
            className="tab"
            data-tab="history"
            aria-current={screen === 'history'}
            onClick={() => onNavigate('history')}
          >
            {t('tab_history')}
          </button>
        </div>
      )}
      <span className={`pill ${connected ? '' : 'off'}`}>
        <span className="live" />
        <span>{connected ? t('connected') : t('offline')}</span>
      </span>
      <div className="lang">
        <button
          type="button"
          data-lang="ru"
          aria-pressed={lang === 'ru'}
          onClick={() => setLang('ru')}
        >
          RU
        </button>
        <button
          type="button"
          data-lang="en"
          aria-pressed={lang === 'en'}
          onClick={() => setLang('en')}
        >
          EN
        </button>
      </div>
    </div>
  )
}
