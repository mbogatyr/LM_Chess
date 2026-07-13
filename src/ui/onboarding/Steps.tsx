import { useI18n } from '../app/i18n'
import type { TKey } from '../app/i18n'

const KEYS: TKey[] = ['step_connect', 'step_model', 'step_elo']

export function Steps({ active }: { active: 1 | 2 | 3 }) {
  const { t } = useI18n()
  return (
    <div className="onb-steps">
      {KEYS.map((k, i) => (
        <i key={k} className={i < active ? 'on' : ''} />
      ))}{' '}
      <span>
        {t(KEYS[active - 1])} · {active}/3
      </span>
    </div>
  )
}
