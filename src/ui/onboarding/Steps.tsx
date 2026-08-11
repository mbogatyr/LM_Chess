import { useI18n } from '../app/i18n'
import type { TKey } from '../app/i18n'

// The ELO step is hidden (2026-08-11 spec) — the wizard shows two steps.
// step_elo stays in i18n; OnboardingElo stays in the tree, unrendered.
const KEYS: TKey[] = ['step_connect', 'step_model']

export function Steps({ active }: { active: 1 | 2 }) {
  const { t } = useI18n()
  return (
    <div className="onb-steps">
      {KEYS.map((k, i) => (
        <i key={k} className={i < active ? 'on' : ''} />
      ))}{' '}
      <span>
        {t(KEYS[active - 1])} · {active}/{KEYS.length}
      </span>
    </div>
  )
}
