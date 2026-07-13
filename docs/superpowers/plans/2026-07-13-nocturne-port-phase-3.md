# Nocturne Port — Phase 3 (History + topbar tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the static History screen (stat tiles + match table on demo data) and the Game/History topbar tabs that reach it; the entire Appearance feature stays deferred.

**Architecture:** Presentational React on demo data, mirroring the vendored `history.js`. A pure `historyStats()` in `demoData.ts` holds the arithmetic; `HistoryScreen` renders it via `useI18n`. `Topbar` becomes prop-driven (`screen` + `onNavigate`) so tabs show only on the `game`/`history` screens; `AppShell` forwards those props and `App` routes `history` to the real screen.

**Tech Stack:** React 18 + TypeScript 5 (strict), Vite 6, Vitest + @testing-library/react (jsdom), ESLint 9, Prettier 3.

## Global Constraints

- **Frontend-only, no backend, no new deps.** Phase 3 adds no npm packages.
- **No new global CSS and no new i18n keys** — every class (`.lb`, `.lb-stats`, `.card`, `.stat`, `.elev-sm`, `.table`, `.text-muted`, `.res`, `.topbar-tabs`, `.tab`, `.pill`) and every key (`lb_h`, `lb_p`, `st_played`, `st_winrate`, `st_streak`, `st_best`, `col_*`, `win`, `loss`, `draw`, `tab_game`, `tab_history`) is already vendored from Phases 1–2.
- **Source of truth is on disk:** `docs/design-reference/gambit-local/app/history.js` (markup), `.../data.js` (HISTORY data), `.../main.js` (`Chrome.render` topbar order).
- **Prettier config:** no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing.
- **Chess rules / chess.js are out of scope** — nothing here touches gameplay.
- **Branch:** all work on `feat/nocturne-port-phase-3`, merged via PR with green CI. Do not commit to `main`.
- **Local quality gate (mirrors CI), run before pushing:**
  `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`

---

## File Structure

- **Modify** `src/ui/app/demoData.ts` — append `HistoryEntry`, `HISTORY`, `HistoryStats`, `historyStats`.
- **Create** `src/ui/app/demoData.test.ts` — unit tests for `historyStats` (this file does not exist yet; `ELO_BANDS`/`eloBand` are currently exercised only by `appState.test.tsx`).
- **Create** `src/ui/history/HistoryScreen.tsx` — the History screen.
- **Create** `src/ui/history/HistoryScreen.test.tsx` — RTL tests.
- **Modify** `src/ui/shell/Topbar.tsx` — add the tabs; add `screen` + `onNavigate` props.
- **Modify** `src/ui/shell/Topbar.test.tsx` — update the render helper; add tab tests.
- **Modify** `src/ui/shell/AppShell.tsx` — accept and forward `screen` + `onNavigate`.
- **Modify** `src/App.tsx` — pass `screen`/`onNavigate` to `AppShell`; route `history` to `HistoryScreen`; drop the now-unused `GamePlaceholder` import.

---

### Task 1: Match-history data + stats helper

**Files:**
- Modify: `src/ui/app/demoData.ts` (append below the existing `eloBand`)
- Test: `src/ui/app/demoData.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type HistoryEntry = { date: string; edate: string; opp: string; elo: number; len: number; res: 'win' | 'loss' | 'draw'; open: string; eopen: string }`
  - `const HISTORY: HistoryEntry[]` (8 entries)
  - `type HistoryStats = { played: number; winRate: number; streak: number; best: number }`
  - `function historyStats(entries: HistoryEntry[]): HistoryStats`

- [ ] **Step 1: Write the failing test**

Create `src/ui/app/demoData.test.ts`:

```ts
import { expect, test } from 'vitest'
import { HISTORY, historyStats, type HistoryEntry } from './demoData'

const entry = (
  res: HistoryEntry['res'],
  elo = 1000,
): HistoryEntry => ({
  date: '',
  edate: '',
  opp: '',
  elo,
  len: 0,
  res,
  open: '',
  eopen: '',
})

test('historyStats on the demo history', () => {
  expect(historyStats(HISTORY)).toEqual({
    played: 8,
    winRate: 63,
    streak: 1,
    best: 1350,
  })
})

test('streak counts only the leading run of wins', () => {
  expect(
    historyStats([entry('win'), entry('win'), entry('loss'), entry('win')])
      .streak,
  ).toBe(2)
  expect(historyStats([entry('loss'), entry('win')]).streak).toBe(0)
})

test('winRate rounds to the nearest percent and best is the max elo', () => {
  const stats = historyStats([
    entry('win', 900),
    entry('loss', 1200),
    entry('loss', 1100),
  ])
  expect(stats.winRate).toBe(33)
  expect(stats.best).toBe(1200)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/app/demoData.test.ts`
Expected: FAIL — `historyStats`/`HISTORY` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui/app/demoData.ts` (after the existing `eloBand` function). `HISTORY` is copied verbatim from `docs/design-reference/gambit-local/app/data.js`:

```ts
// HISTORY: ported verbatim from docs/design-reference/gambit-local/app/data.js (HISTORY).
export type HistoryEntry = {
  date: string
  edate: string
  opp: string
  elo: number
  len: number
  res: 'win' | 'loss' | 'draw'
  open: string
  eopen: string
}

export const HISTORY: HistoryEntry[] = [
  { date: '11 июл', edate: 'Jul 11', opp: 'Qwen2.5 14B', elo: 1350, len: 41, res: 'win', open: 'Итальянская партия', eopen: 'Italian Game' },
  { date: '10 июл', edate: 'Jul 10', opp: 'Llama 3.1 8B', elo: 1200, len: 58, res: 'loss', open: 'Сицилианская защита', eopen: 'Sicilian Defence' },
  { date: '9 июл', edate: 'Jul 9', opp: 'Qwen2.5 14B', elo: 1350, len: 33, res: 'win', open: 'Ферзевый гамбит', eopen: "Queen's Gambit" },
  { date: '8 июл', edate: 'Jul 8', opp: 'Mistral Nemo', elo: 1100, len: 27, res: 'win', open: 'Испанская партия', eopen: 'Ruy López' },
  { date: '7 июл', edate: 'Jul 7', opp: 'Phi-3.5 Mini', elo: 800, len: 22, res: 'win', open: 'Защита Каро-Канн', eopen: 'Caro-Kann' },
  { date: '6 июл', edate: 'Jul 6', opp: 'Qwen2.5 14B', elo: 1350, len: 64, res: 'draw', open: 'Английское начало', eopen: 'English Opening' },
  { date: '5 июл', edate: 'Jul 5', opp: 'DeepSeek R1 7B', elo: 950, len: 45, res: 'loss', open: 'Французская защита', eopen: 'French Defence' },
  { date: '4 июл', edate: 'Jul 4', opp: 'Llama 3.1 8B', elo: 1200, len: 38, res: 'win', open: 'Славянская защита', eopen: 'Slav Defence' },
]

export type HistoryStats = {
  played: number
  winRate: number
  streak: number
  best: number
}

// Mirrors the arithmetic in docs/design-reference/gambit-local/app/history.js.
export function historyStats(entries: HistoryEntry[]): HistoryStats {
  const played = entries.length
  const wins = entries.filter((e) => e.res === 'win').length
  const winRate = Math.round((wins / played) * 100)
  let streak = 0
  for (const e of entries) {
    if (e.res === 'win') streak++
    else break
  }
  const best = Math.max(...entries.map((e) => e.elo))
  return { played, winRate, streak, best }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/app/demoData.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/app/demoData.ts src/ui/app/demoData.test.ts
git commit -m "feat: add match-history demo data and stats helper"
```

---

### Task 2: History screen

**Files:**
- Create: `src/ui/history/HistoryScreen.tsx`
- Test: `src/ui/history/HistoryScreen.test.tsx`

**Interfaces:**
- Consumes: `HISTORY`, `historyStats` from `../app/demoData`; `useI18n` from `../app/i18n` (returns `{ t, lang, setLang }`; `t(key: TKey)` where `'win' | 'loss' | 'draw'` are valid keys).
- Produces: `function HistoryScreen(): JSX.Element` (no props).

- [ ] **Step 1: Write the failing test**

Create `src/ui/history/HistoryScreen.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { HistoryScreen } from './HistoryScreen'
import { I18nProvider, useI18n } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

function Harness() {
  const { setLang } = useI18n()
  return (
    <>
      <button onClick={() => setLang('en')}>to-en</button>
      <HistoryScreen />
    </>
  )
}

test('renders the four stat tiles with computed values', () => {
  render(wrap(<HistoryScreen />))
  expect(screen.getByText('Партий')).toBeInTheDocument()
  expect(screen.getByText('8')).toBeInTheDocument()
  expect(screen.getByText('63%')).toBeInTheDocument()
  expect(screen.getByText('+1')).toBeInTheDocument()
  const best = screen.getByText('Лучший ELO')
  expect(
    within(best.parentElement as HTMLElement).getByText('1350'),
  ).toBeInTheDocument()
})

test('renders one row per history entry plus the header', () => {
  render(wrap(<HistoryScreen />))
  expect(screen.getAllByRole('row')).toHaveLength(9)
})

test('result cells carry the res win/loss/draw classes', () => {
  const { container } = render(wrap(<HistoryScreen />))
  expect(container.querySelectorAll('.res.win')).toHaveLength(5)
  expect(container.querySelectorAll('.res.loss')).toHaveLength(2)
  expect(container.querySelectorAll('.res.draw')).toHaveLength(1)
})

test('language toggle swaps date and opening RU to EN', async () => {
  render(wrap(<Harness />))
  expect(screen.getByText('Итальянская партия')).toBeInTheDocument()
  await userEvent.click(screen.getByText('to-en'))
  expect(screen.getByText('Italian Game')).toBeInTheDocument()
  expect(screen.getByText('Jul 11')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/history/HistoryScreen.test.tsx`
Expected: FAIL — `./HistoryScreen` cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/history/HistoryScreen.tsx` (structure ported 1:1 from `docs/design-reference/gambit-local/app/history.js`):

```tsx
import { useI18n } from '../app/i18n'
import { HISTORY, historyStats } from '../app/demoData'

export function HistoryScreen() {
  const { t, lang } = useI18n()
  const { played, winRate, streak, best } = historyStats(HISTORY)
  const ru = lang === 'ru'
  return (
    <div className="lb">
      <div>
        <h2 style={{ marginBottom: 4 }}>{t('lb_h')}</h2>
        <p className="text-muted" style={{ margin: 0 }}>
          {t('lb_p')}
        </p>
      </div>
      <div className="lb-stats">
        <div className="card stat elev-sm">
          <span className="k">{t('st_played')}</span>
          <span className="v">{played}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_winrate')}</span>
          <span className="v pos">{winRate}%</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_streak')}</span>
          <span className="v">{streak > 0 ? `+${streak}` : '0'}</span>
        </div>
        <div className="card stat elev-sm">
          <span className="k">{t('st_best')}</span>
          <span className="v">{best}</span>
        </div>
      </div>
      <div
        className="card elev-sm"
        style={{ padding: 'var(--space-2) var(--space-4)' }}
      >
        <table className="table">
          <thead>
            <tr>
              <th>{t('col_date')}</th>
              <th>{t('col_opp')}</th>
              <th>{t('col_elo')}</th>
              <th>{t('col_len')}</th>
              <th>{t('col_res')}</th>
              <th>{t('col_open')}</th>
            </tr>
          </thead>
          <tbody>
            {HISTORY.map((h) => (
              <tr key={h.edate}>
                <td className="text-muted">{ru ? h.date : h.edate}</td>
                <td>{h.opp}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.elo}</td>
                <td
                  className="text-muted"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {h.len}
                </td>
                <td>
                  <span className={`res ${h.res}`}>{t(h.res)}</span>
                </td>
                <td className="text-muted">{ru ? h.open : h.eopen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/history/HistoryScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/history/HistoryScreen.tsx src/ui/history/HistoryScreen.test.tsx
git commit -m "feat: add static History screen on demo data"
```

---

### Task 3: Topbar Game/History tabs

**Files:**
- Modify: `src/ui/shell/Topbar.tsx`
- Modify: `src/ui/shell/Topbar.test.tsx`

**Interfaces:**
- Consumes: `Screen` type from `../app/appState` (`'onb-connect' | 'onb-models' | 'onb-elo' | 'game' | 'history'`); `useI18n`.
- Produces: `Topbar` now takes `{ connected: boolean; screen: Screen; onNavigate: (s: Screen) => void }`.

- [ ] **Step 1: Update the existing test helper and add the failing tab tests**

Replace the whole contents of `src/ui/shell/Topbar.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Topbar } from './Topbar'
import { I18nProvider } from '../app/i18n'
import type { Screen } from '../app/appState'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderTopbar(
  connected: boolean,
  screenName: Screen = 'onb-connect',
  onNavigate: (s: Screen) => void = () => {},
) {
  return render(
    <I18nProvider>
      <Topbar
        connected={connected}
        screen={screenName}
        onNavigate={onNavigate}
      />
    </I18nProvider>,
  )
}

test('shows the brand and the offline pill when disconnected', () => {
  renderTopbar(false)
  expect(screen.getByText('NeuroChess')).toBeInTheDocument()
  expect(screen.getByText('Не подключено')).toBeInTheDocument()
})

test('shows the connected pill when connected', () => {
  renderTopbar(true)
  expect(screen.getByText('Подключено')).toBeInTheDocument()
})

test('RU/EN toggle switches the visible language', async () => {
  renderTopbar(false)
  expect(screen.getByText('Не подключено')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('Offline')).toBeInTheDocument()
})

test('hides the tabs during onboarding', () => {
  renderTopbar(false, 'onb-connect')
  expect(
    screen.queryByRole('button', { name: 'Партия' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'История' }),
  ).not.toBeInTheDocument()
})

test('shows the tabs on the game and history screens', () => {
  renderTopbar(true, 'game')
  expect(screen.getByRole('button', { name: 'Партия' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'История' })).toBeInTheDocument()
})

test('marks the active tab with aria-current', () => {
  renderTopbar(true, 'history')
  expect(screen.getByRole('button', { name: 'История' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Партия' })).toHaveAttribute(
    'aria-current',
    'false',
  )
})

test('clicking a tab calls onNavigate with the screen', async () => {
  const onNavigate = vi.fn()
  renderTopbar(true, 'game', onNavigate)
  await userEvent.click(screen.getByRole('button', { name: 'История' }))
  expect(onNavigate).toHaveBeenCalledWith('history')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/shell/Topbar.test.tsx`
Expected: FAIL — `Topbar` does not yet accept `screen`/`onNavigate` and renders no tabs (type error and/or failing tab assertions).

- [ ] **Step 3: Write minimal implementation**

Replace the whole contents of `src/ui/shell/Topbar.tsx` with (tabs placed between brand and pill, matching `Chrome.render()` order in `main.js`):

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/shell/Topbar.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add src/ui/shell/Topbar.tsx src/ui/shell/Topbar.test.tsx
git commit -m "feat: add Game/History tabs to the topbar"
```

---

### Task 4: Wire the shell and route to History

**Files:**
- Modify: `src/ui/shell/AppShell.tsx`
- Modify: `src/App.tsx`

No new unit test: both files are thin composition. They are covered by `tsc -b` (props must line up), the full test suite (existing `App.test.tsx` still renders the default `onb-connect` screen), and the live-browser check below.

**Interfaces:**
- Consumes: `Topbar` `{ connected, screen, onNavigate }` (Task 3); `HistoryScreen` (Task 2); `Screen`, `useAppState` (`{ screen, setScreen, ... }`).
- Produces: `AppShell` now takes `{ connected, screen, onNavigate, children }`.

- [ ] **Step 1: Forward the new props through AppShell**

Replace the whole contents of `src/ui/shell/AppShell.tsx` with:

```tsx
import type { ReactNode } from 'react'
import { Topbar } from './Topbar'
import type { Screen } from '../app/appState'

export function AppShell({
  connected,
  screen,
  onNavigate,
  children,
}: {
  connected: boolean
  screen: Screen
  onNavigate: (s: Screen) => void
  children: ReactNode
}) {
  return (
    <div className="app">
      <div className="chrome">
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <div className="url">neurochess.local — LM Studio · localhost:1234</div>
        <div style={{ width: 52 }} />
      </div>
      <Topbar connected={connected} screen={screen} onNavigate={onNavigate} />
      <div className="screens">
        <div className="screen">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Route history to the real screen in App**

In `src/App.tsx`:

1. Remove the `GamePlaceholder` import line:
   ```tsx
   import { GamePlaceholder } from './ui/game/GamePlaceholder'
   ```
2. Add the `HistoryScreen` import next to the other UI imports:
   ```tsx
   import { HistoryScreen } from './ui/history/HistoryScreen'
   ```
3. Pass the new props to `AppShell`:
   ```tsx
   <AppShell connected={connected} screen={screen} onNavigate={setScreen}>
   ```
4. Replace the history branch:
   ```tsx
   {screen === 'history' && <HistoryScreen />}
   ```

After the edits `src/App.tsx` reads:

```tsx
import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { OnboardingElo } from './ui/onboarding/OnboardingElo'
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
      {screen === 'onb-models' && (
        <OnboardingModels conn={conn} onUse={() => setScreen('onb-elo')} />
      )}
      {screen === 'onb-elo' && (
        <OnboardingElo
          onBack={() => setScreen('onb-models')}
          onStart={() => setScreen('game')}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'}
          elo={elo}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
        />
      )}
      {screen === 'history' && <HistoryScreen />}
    </AppShell>
  )
}
```

- [ ] **Step 3: Run the full quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green. (`tsc -b` catches any prop mismatch; the full suite includes every prior phase's tests.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/shell/AppShell.tsx src/App.tsx
git commit -m "feat: route History screen and wire topbar tabs"
```

- [ ] **Step 5: Live-browser verification**

With LM Studio running on `http://localhost:1234` (model `google/gemma-4-e4b`):

1. `npm run dev` and open the app.
2. Complete onboarding (Connect → test → choose a model → Play → ELO → Start) to reach the **Game** screen; confirm the **Game / History** tabs now appear in the topbar and no Appearance button is present.
3. Click **History**: verify the four stat tiles read **Партий 8**, **Побед 63%**, **Серия +1**, **Лучший ELO 1350**, and the table shows 8 rows with green/red/grey result labels.
4. Toggle **EN**: verify tab labels, headers, dates (`Jul 11` …), openings (`Italian Game` …) and result words switch to English.
5. Click **Game** to confirm the tab navigates back to the game screen (`aria-current` follows).

---

## Self-Review

**Spec coverage:**
- History screen (tiles + table, bilingual, demo data) → Task 2. ✓
- `HISTORY` data + `historyStats` arithmetic (played 8 / winRate 63 / streak 1 / best 1350) → Task 1. ✓
- Topbar Game/History tabs, visible only on game/history, `aria-current`, no Appearance button → Task 3. ✓
- Prop-driven Topbar via AppShell/App; history routed to `HistoryScreen` → Tasks 3–4. ✓
- Testing strategy (historyStats pure test, HistoryScreen RTL, Topbar tabs) → Tasks 1–3. ✓
- Out-of-scope items (Appearance sheet/button/pickers, real data) → not built. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content; every command has an expected result. ✓

**Type consistency:** `HistoryEntry`/`HistoryStats`/`historyStats` (Task 1) are consumed with the same names/shapes in Task 2; `Screen` and the `{ connected, screen, onNavigate }` prop shape are identical across Tasks 3–4; `useI18n` returns `{ t, lang, setLang }` as used. ✓
