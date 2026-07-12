import { useI18n } from '../app/i18n'
import { Logo } from './Logo'

export function Topbar({ connected }: { connected: boolean }) {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-txt">
          <b>NeuroChess</b>
          <span>{t('subtitle')}</span>
        </div>
      </div>
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
