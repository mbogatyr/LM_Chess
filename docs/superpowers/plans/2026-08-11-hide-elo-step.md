# Hide the ELO Onboarding Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The onboarding wizard becomes two steps (Connect → Models, "Играть" lands directly on the game screen); the ELO step's code stays in the tree, compiling and tested, but unreachable.

**Architecture:** Pure routing + presentation change. `App.tsx` routes `onUse` straight to `'game'` and drops the `onb-elo` render branch; `Steps.tsx` shrinks its indicator to two entries; the hidden `OnboardingElo.tsx` gets a one-token edit (`active={2}`) so it still compiles. `appState.elo` (persisted, default 1000) keeps flowing into prompts/hints untouched. Spec: `docs/superpowers/specs/2026-08-11-hide-elo-step-design.md`.

**Tech Stack:** React 18 + TypeScript 5 strict, Vitest + Testing Library (jsdom), Prettier/ESLint.

## Global Constraints

- **Hide, don't delete:** `OnboardingElo.tsx` + `OnboardingElo.test.tsx` stay in the tree and stay green; `'onb-elo'` stays in the `Screen` union (`src/ui/app/appState.tsx`); the `step_elo` and `confirm_*` i18n keys stay.
- **No changes** to `appState.tsx`, `useGame.ts`, `selectMove.ts`, adapters, `GameScreen.tsx`, or `i18n.tsx`.
- TypeScript strict; Prettier (no semicolons, single quotes, trailing commas, 80 col) — `npm run format` before each commit.
- Quality gate before pushing: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- Branch `feat/hide-elo-step`; conventional commits.

## File Structure

```
Modify: src/ui/onboarding/Steps.tsx          # 2-entry indicator
Create: src/ui/onboarding/Steps.test.tsx     # new: dots + caption assertions
Modify: src/ui/onboarding/OnboardingElo.tsx  # active={3} → active={2} only
Modify: src/App.tsx                          # route onUse → 'game'; drop branch
Modify: src/App.test.tsx                     # wizard e2e loses the ELO leg
Modify: CLAUDE.md                            # onboarding line reflects hidden step
```

---

### Task 1: Two-step indicator (`Steps.tsx`) + keep `OnboardingElo` compiling

**Files:**

- Create: `src/ui/onboarding/Steps.test.tsx`
- Modify: `src/ui/onboarding/Steps.tsx`
- Modify: `src/ui/onboarding/OnboardingElo.tsx` (one token)

**Interfaces:**

- Consumes: i18n keys `step_connect` ('Подключение'/'Connect'), `step_model` ('Модель'/'Model').
- Produces: `Steps({ active }: { active: 1 | 2 })` — Task 2's screens keep calling `<Steps active={1|2} />` unchanged.

- [ ] **Step 1: Write the failing test** (`src/ui/onboarding/Steps.test.tsx`)

```tsx
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../app/i18n'
import { Steps } from './Steps'

function renderSteps(active: 1 | 2) {
  return render(
    <I18nProvider>
      <Steps active={active} />
    </I18nProvider>,
  )
}

test('renders two dots and the 1/2 caption on the first step', () => {
  const { container } = renderSteps(1)
  expect(container.querySelectorAll('.onb-steps i')).toHaveLength(2)
  expect(screen.getByText('Подключение · 1/2')).toBeInTheDocument()
})

test('renders the 2/2 caption on the model step', () => {
  renderSteps(2)
  expect(screen.getByText('Модель · 2/2')).toBeInTheDocument()
})
```

(Note: the caption is a single `<span>` whose text `getByText` sees as
`'<label> · N/2'` — verify against the DOM if the JSX whitespace splits it;
if it does, match with a regex `screen.getByText(/Подключение\s*·\s*1\/2/)`.)

- [ ] **Step 2: Run tests, verify they fail** — `npx vitest run src/ui/onboarding/Steps.test.tsx` → FAIL (3 dots / `1/3` captions).

- [ ] **Step 3: Implement.** `src/ui/onboarding/Steps.tsx` becomes:

```tsx
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
```

And in `src/ui/onboarding/OnboardingElo.tsx` change only line 21:

```tsx
<Steps active={2} />
```

(This file is hidden-but-compiling; `active={3}` no longer typechecks.)

- [ ] **Step 4: Run tests, verify they pass** — `npx vitest run src/ui/onboarding` → Steps tests PASS and `OnboardingElo.test.tsx` still PASSES (it asserts copy/slider behavior, not the step counter).

- [ ] **Step 5: Run `npm run typecheck`** — PASS (proves the hidden component compiles against the narrowed type).

- [ ] **Step 6: Commit**

```bash
git add src/ui/onboarding/Steps.tsx src/ui/onboarding/Steps.test.tsx src/ui/onboarding/OnboardingElo.tsx
git commit -m "feat(onboarding): two-step wizard indicator (ELO step hidden)"
```

---

### Task 2: Route Models → game (`App.tsx`)

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**

- Consumes: `Steps` from Task 1 (unchanged call sites), `useAppState().elo` (still passed to `GameScreen`).
- Produces: the two-step wizard flow; `'onb-elo'` remains a `Screen` member nothing navigates to.

- [ ] **Step 1: Update the e2e wizard test to the new flow** (`src/App.test.tsx`) — replace the first test entirely:

```tsx
test('connect → choose model → game', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  renderApp()
  // connect (auto-advances to model selection on success)
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  // models → play the loaded model: lands directly on the game screen
  await userEvent.click(await screen.findByRole('button', { name: 'Играть' }))
  expect(await screen.findByText('Ваш ход')).toBeInTheDocument()
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
  expect(document.querySelector('.game .board')).not.toBeNull()
  // the ELO step never appears
  expect(screen.queryByText('Начать партию')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run it, verify it fails** — `npx vitest run src/App.test.tsx` → FAIL (the app still shows the ELO screen after "Играть"; 'Ваш ход' never appears).

- [ ] **Step 3: Implement.** In `src/App.tsx`: delete the `OnboardingElo` import, route `onUse` to `'game'`, delete the `onb-elo` branch:

```tsx
import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { GameScreen } from './ui/game/GameScreen'
import { HistoryScreen } from './ui/history/HistoryScreen'

export default function App() {
  const conn = useConnection()
  const { screen, setScreen, elo, boardStyle, pieceStyle } = useAppState()
  const connected =
    conn.state.phase === 'connected' || conn.state.phase === 'ready'

  return (
    <AppShell connected={connected} screen={screen} onNavigate={setScreen}>
      {screen === 'onb-connect' && (
        <OnboardingConnect
          conn={conn}
          onConnected={() => setScreen('onb-models')}
        />
      )}
      {/* The ELO step (onb-elo / OnboardingElo) is hidden — see
          docs/superpowers/specs/2026-08-11-hide-elo-step-design.md. The
          component stays in src/ui/onboarding; `elo` keeps its stored or
          default value and still flows into the prompts below. */}
      {screen === 'onb-models' && (
        <OnboardingModels conn={conn} onUse={() => setScreen('game')} />
      )}
      {screen === 'game' && (
        <GameScreen
          opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'}
          elo={elo}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
          baseUrl={conn.state.baseUrl}
          model={conn.state.activeModel ?? ''}
        />
      )}
      {screen === 'history' && <HistoryScreen />}
    </AppShell>
  )
}
```

- [ ] **Step 4: Run the full test suite** — `npm test` → PASS (the rewritten e2e test, Steps tests, and the untouched `OnboardingElo.test.tsx` all green).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(onboarding): hide the ELO step — Use lands directly on the game"
```

---

### Task 3: Docs + gate + finish

**Files:**

- Modify: `CLAUDE.md` (project-structure `onboarding/` line)

- [ ] **Step 1: Update `CLAUDE.md`** — the structure line
      `onboarding/ # wizard: Connect → Models → ELO (…)` becomes:

```
    onboarding/ # wizard: Connect → Models (ELO step hidden 2026-08-11 — OnboardingElo stays in the tree unrendered; elo state still feeds prompts at its stored/default value)
```

- [ ] **Step 2: Full gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all five green.

- [ ] **Step 3: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: onboarding wizard is two steps (ELO hidden)"
```

- [ ] **Step 4: Finish the branch** — invoke `superpowers:finishing-a-development-branch` (PR from `feat/hide-elo-step` to `main`, CI green).
