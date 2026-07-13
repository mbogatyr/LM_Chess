# Nocturne Design Port — Phase 1 (Foundation + Shell + Wired Onboarding)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give LM_Chess the Nocturne look and the NeuroChess app shell + onboarding wizard, with the Connect and Models steps wired to the real LM Studio client.

**Architecture:** Vendor the Nocturne token sheet + app CSS as global styles and Inter locally. Add a small `src/ui/app` layer (i18n RU/EN, app-state context, demo data). Build the window chrome + topbar and the onboarding wizard (Connect → Models → ELO → placeholder Game) as React components; Connect/Models drive the existing `useConnection` hook. `App.tsx` becomes a screen switch. This replaces the old `ConnectionDialog`/`ConnectedView`.

**Tech Stack:** React 18 + TS strict, Vitest + @testing-library/react + user-event, `@fontsource/inter`, plain global CSS. No router library.

## Global Constraints

- The vendored design source under `docs/design-reference/gambit-local/` is the source of truth for markup classes, structure and copy. Implementers READ those files from disk (`_ds/styles.css`, `app/app.css`, `app/data.js`, `app/onboarding.js`, `app/main.js`). Reproduce their class names exactly; never invent parallel styling.
- Styling comes only from Nocturne tokens/classes (`var(--color-*)`, `.btn`, `.onb-card`, `.model-row`, …). No hard-coded hexes in components.
- Bilingual RU + EN; default language `ru`. Persisted state uses `localStorage` key `nocturne-chess` holding `{ lang, boardStyle, pieceStyle, elo }` (matching the prototype), read/written as a JSON object.
- Offline/static: no remote assets. Inter is vendored via `@fontsource/inter`; the Google-Fonts `@import` line is removed from the vendored `nocturne.css`.
- `src/ui` must not call `fetch`; network only via `src/llm` through `useConnection`.
- Real JIT load has no progress events — Load shows a spinner (no progress bar).
- Default server URL is exactly `http://localhost:1234`.
- TS strict; Prettier (no semicolons, single quotes, trailing commas). Run `npm run format` before committing.
- No real network in tests — mock the `src/llm/client` module.
- Local quality gate before finishing a phase: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

### Task 1: Vendor Nocturne CSS + Inter font

Bring the design system in as global CSS and load Inter locally, imported once from the entry. Deliverable: the app renders on the dark Nocturne ground with Inter, existing tests still green.

**Files:**

- Create: `src/styles/nocturne.css` (copy of `docs/design-reference/gambit-local/_ds/styles.css` with the first-line `@import url('https://fonts.googleapis.com/...')` **removed**)
- Create: `src/styles/app.css` (verbatim copy of `docs/design-reference/gambit-local/app/app.css`)
- Modify: `src/main.tsx` (add CSS + font imports)
- Modify: `package.json` (add `@fontsource/inter` dependency)

**Interfaces:**

- Consumes: nothing.
- Produces: global classes (`.btn*`, `.field`, `.input`, `.card`, `.tag*`, `.onb*`, `.model-row`, `.topbar`, `.pill`, `.lang`, `.brand*`, `.app`, `.chrome`, …) and the `--color-*/--space-*/--radius-*/--shadow-*/--font-*` tokens, available app-wide.

- [ ] **Step 1: Install the font package**

Run: `npm install @fontsource/inter@^5`
Expected: adds `@fontsource/inter` to `dependencies`; lockfile updated.

- [ ] **Step 2: Vendor `src/styles/nocturne.css`**

Copy `docs/design-reference/gambit-local/_ds/styles.css` to `src/styles/nocturne.css` verbatim, then delete its first line (the `@import url('https://fonts.googleapis.com/css2?family=Inter...')`). Everything else (tokens, base type, components) stays byte-for-byte.

- [ ] **Step 3: Vendor `src/styles/app.css`**

Copy `docs/design-reference/gambit-local/app/app.css` to `src/styles/app.css` verbatim.

- [ ] **Step 4: Import styles + Inter in `src/main.tsx`**

Add these imports at the top of `src/main.tsx` (before the `App` import), keeping the existing render code:

```tsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/nocturne.css'
import './styles/app.css'
```

- [ ] **Step 5: Verify the toolchain still passes**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green. (CSS imports don't break the jsdom tests; the build inlines the vendored CSS + font files.)

- [ ] **Step 6: Commit**

```bash
git add src/styles src/main.tsx package.json package-lock.json
git commit -m "feat(ui): vendor Nocturne CSS and Inter font"
```

---

### Task 2: i18n (RU/EN) — `src/ui/app/i18n.tsx`

Port the string table and expose a `t()` + language switch with persistence.

**Files:**

- Create: `src/ui/app/i18n.tsx`
- Test: `src/ui/app/i18n.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type Lang = 'ru' | 'en'`
  - `type TKey = keyof (typeof STRINGS)['ru']`
  - `I18nProvider({ children }: { children: ReactNode }): JSX.Element` — reads initial `lang` from `localStorage['nocturne-chess'].lang` (default `'ru'`).
  - `useI18n(): { lang: Lang; setLang(l: Lang): void; t(key: TKey): string }` — `setLang` persists `lang` into the `nocturne-chess` JSON object (merging, not clobbering other keys).
  - `STRINGS` — the RU/EN table ported verbatim from `docs/design-reference/gambit-local/app/data.js` (`I18N`). Include every key present there.

- [ ] **Step 1: Write the failing test `src/ui/app/i18n.test.tsx`**

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { I18nProvider, useI18n } from './i18n'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
)

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('defaults to Russian and translates a key', () => {
  const { result } = renderHook(() => useI18n(), { wrapper })
  expect(result.current.lang).toBe('ru')
  expect(result.current.t('connect_h')).toBe('Подключитесь к LM Studio')
})

test('setLang switches language and persists it', () => {
  const { result } = renderHook(() => useI18n(), { wrapper })
  act(() => result.current.setLang('en'))
  expect(result.current.t('connect_h')).toBe('Connect to LM Studio')
  expect(JSON.parse(localStorage.getItem('nocturne-chess')!).lang).toBe('en')
})

test('reads persisted language on init and preserves other stored keys', () => {
  localStorage.setItem(
    'nocturne-chess',
    JSON.stringify({ lang: 'en', elo: 1200 }),
  )
  const { result } = renderHook(() => useI18n(), { wrapper })
  expect(result.current.lang).toBe('en')
  act(() => result.current.setLang('ru'))
  const stored = JSON.parse(localStorage.getItem('nocturne-chess')!)
  expect(stored.lang).toBe('ru')
  expect(stored.elo).toBe(1200)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/app/i18n.test.tsx`
Expected: FAIL — cannot resolve `./i18n`.

- [ ] **Step 3: Implement `src/ui/app/i18n.tsx`**

Port the full `I18N` object from `docs/design-reference/gambit-local/app/data.js` into a `STRINGS` const (both `ru` and `en`, every key verbatim). Then:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'ru' | 'en'

// STRINGS: paste the full I18N table from data.js here (ru + en).
export const STRINGS = {
  ru: {/* …every key from data.js I18N.ru… */},
  en: {/* …every key from data.js I18N.en… */},
} as const

export type TKey = keyof (typeof STRINGS)['ru']

const STORAGE_KEY = 'nocturne-chess'

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), lang }))
}

type I18nValue = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: TKey) => string
}
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    readStore().lang === 'en' ? 'en' : 'ru',
  )
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    writeLang(l)
  }, [])
  const t = useCallback((key: TKey) => STRINGS[lang][key], [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
```

The `STRINGS` object MUST contain every key from `data.js` `I18N` (both languages) so `TKey` covers them. Do not abbreviate.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/app/i18n.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app/i18n.tsx src/ui/app/i18n.test.tsx
git commit -m "feat(ui): add RU/EN i18n provider"
```

---

### Task 3: App state + demo data — `src/ui/app/appState.tsx`, `src/ui/app/demoData.ts`

The screen router state, the ELO value, and the static ELO bands.

**Files:**

- Create: `src/ui/app/appState.tsx`
- Create: `src/ui/app/demoData.ts`
- Test: `src/ui/app/appState.test.tsx`

**Interfaces:**

- Consumes: `localStorage` key `nocturne-chess` (shared with i18n).
- Produces:
  - `type Screen = 'onb-connect' | 'onb-models' | 'onb-elo' | 'game' | 'history'`
  - `AppStateProvider({ children }): JSX.Element`
  - `useAppState(): { screen: Screen; setScreen(s: Screen): void; elo: number; setElo(n: number): void }` — initial `screen` is `'onb-connect'`; initial `elo` from `localStorage['nocturne-chess'].elo` or `1000`; `setElo` persists `elo` (merging into the store).
  - In `demoData.ts`: `type EloBand = { max: number; ru: [string, string]; en: [string, string] }`; `ELO_BANDS: EloBand[]` (ported verbatim from `data.js`); `eloBand(v: number): EloBand`.

- [ ] **Step 1: Write the failing test `src/ui/app/appState.test.tsx`**

```tsx
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AppStateProvider, useAppState } from './appState'
import { eloBand } from './demoData'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
)

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('starts on the connect screen with default elo', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  expect(result.current.screen).toBe('onb-connect')
  expect(result.current.elo).toBe(1000)
})

test('setScreen and setElo update and elo persists', () => {
  const { result } = renderHook(() => useAppState(), { wrapper })
  act(() => result.current.setScreen('onb-models'))
  expect(result.current.screen).toBe('onb-models')
  act(() => result.current.setElo(1300))
  expect(result.current.elo).toBe(1300)
  expect(JSON.parse(localStorage.getItem('nocturne-chess')!).elo).toBe(1300)
})

test('eloBand picks the band by upper bound', () => {
  expect(eloBand(500).ru[0]).toBe('Новичок')
  expect(eloBand(1000).ru[0]).toBe('Уверенный')
  expect(eloBand(1500).en[0]).toBe('Candidate')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/app/appState.test.tsx`
Expected: FAIL — cannot resolve `./appState` / `./demoData`.

- [ ] **Step 3: Implement `src/ui/app/demoData.ts`**

Port `ELO_BANDS` and `eloBand` verbatim from `docs/design-reference/gambit-local/app/data.js`:

```ts
export type EloBand = {
  max: number
  ru: [string, string]
  en: [string, string]
}

export const ELO_BANDS: EloBand[] = [
  {
    max: 650,
    ru: [
      'Новичок',
      'Только выучил, как ходят фигуры. Будет зевать всё подряд — идеально, чтобы почувствовать себя гроссмейстером.',
    ],
    en: [
      'Beginner',
      'Just learned how the pieces move. Will hang everything — perfect for feeling like a grandmaster.',
    ],
  },
  {
    max: 850,
    ru: [
      'Любитель',
      'Знает пару ловушек, но плана нет. Накажет грубый зевок, а тонкости пропустит.',
    ],
    en: [
      'Casual',
      'Knows a trap or two but has no plan. Punishes blunders, misses the subtle stuff.',
    ],
  },
  {
    max: 1050,
    ru: [
      'Уверенный',
      'Развивает фигуры, держит центр. Просто так фигуру уже не отдаст — придётся думать.',
    ],
    en: [
      'Steady',
      "Develops pieces, holds the centre. Won't just gift you material anymore — you'll have to think.",
    ],
  },
  {
    max: 1250,
    ru: [
      'Клубный игрок',
      'Видит короткую тактику и считает на пару ходов. Ошибётесь — тут же прилетит вилка.',
    ],
    en: [
      'Club player',
      'Spots short tactics, calculates a couple of moves. Slip up and a fork arrives instantly.',
    ],
  },
  {
    max: 1450,
    ru: [
      'Сильный',
      'Играет по плану, цепляется за слабости. Красивой атакой уже не отделаетесь.',
    ],
    en: [
      'Strong',
      "Plays with a plan, latches onto weaknesses. A flashy attack won't be enough.",
    ],
  },
  {
    max: 1600,
    ru: [
      'Кандидат',
      'Наказывает за каждую неточность и защищается цепко. Готовьтесь работать за доской.',
    ],
    en: [
      'Candidate',
      'Punishes every inaccuracy and defends stubbornly. Get ready to work at the board.',
    ],
  },
]

export function eloBand(v: number): EloBand {
  return ELO_BANDS.find((b) => v <= b.max) ?? ELO_BANDS[ELO_BANDS.length - 1]
}
```

- [ ] **Step 4: Implement `src/ui/app/appState.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Screen =
  'onb-connect' | 'onb-models' | 'onb-elo' | 'game' | 'history'

const STORAGE_KEY = 'nocturne-chess'

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeElo(elo: number): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), elo }))
}

type AppStateValue = {
  screen: Screen
  setScreen: (s: Screen) => void
  elo: number
  setElo: (n: number) => void
}
const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('onb-connect')
  const [elo, setEloState] = useState<number>(() => {
    const stored = readStore().elo
    return typeof stored === 'number' ? stored : 1000
  })
  const setElo = useCallback((n: number) => {
    setEloState(n)
    writeElo(n)
  }, [])
  const value = useMemo(
    () => ({ screen, setScreen, elo, setElo }),
    [screen, elo, setElo],
  )
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/app/appState.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/ui/app/appState.tsx src/ui/app/demoData.ts src/ui/app/appState.test.tsx
git commit -m "feat(ui): add app-state (screen/elo) and demo ELO bands"
```

---

### Task 4: Window chrome + topbar — `src/ui/shell/AppShell.tsx`, `src/ui/shell/Topbar.tsx`, `src/ui/shell/Logo.tsx`

The browser-window frame, the brand logo, and the topbar (brand + connection pill + RU/EN toggle). Tabs and the Appearance button are deferred to Phases 2–3, so Phase 1's topbar shows only what works.

**Files:**

- Create: `src/ui/shell/Logo.tsx`
- Create: `src/ui/shell/Topbar.tsx`
- Create: `src/ui/shell/AppShell.tsx`
- Test: `src/ui/shell/Topbar.test.tsx`

**Interfaces:**

- Consumes: `useI18n` (Task 2).
- Produces:
  - `Logo(): JSX.Element` — the inline low-poly knight SVG. Reproduce the `logoSVG()` markup from `docs/design-reference/gambit-local/app/main.js` (`LOGO_NODES`/`LOGO_EDGES` → `<svg class="logo-mark">` with `.lg-lines` lines and `.lg-dots` circles).
  - `Topbar({ connected }: { connected: boolean }): JSX.Element` — renders the `.topbar` markup from `app/main.js` `Chrome.render()`, but ONLY: `.brand` (Logo + `.brand-txt` with `NeuroChess` + `t('subtitle')`), the `.pill` (`.off` when `!connected`, text `t('connected')`/`t('offline')`), and the `.lang` RU/EN toggle (`aria-pressed` on the active language; clicking calls `useI18n().setLang`). Do NOT render the Game/History tabs or the Appearance button yet.
  - `AppShell({ connected, children }: { connected: boolean; children: ReactNode }): JSX.Element` — the `.app` > `.chrome` (dots + `.url` reading `neurochess.local — LM Studio · localhost:1234`) + `<Topbar connected={connected} />` + `.screens` > `.screen` wrapper around `children`, matching `docs/design-reference/gambit-local/index.html` + `app.css`.

- [ ] **Step 1: Write the failing test `src/ui/shell/Topbar.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Topbar } from './Topbar'
import { I18nProvider } from '../app/i18n'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderTopbar(connected: boolean) {
  return render(
    <I18nProvider>
      <Topbar connected={connected} />
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/shell/Topbar.test.tsx`
Expected: FAIL — cannot resolve `./Topbar`.

- [ ] **Step 3: Implement `src/ui/shell/Logo.tsx`**

Reproduce `logoSVG()` from `app/main.js`: keep `LOGO_NODES` and `LOGO_EDGES` arrays, render an `<svg className="logo-mark" viewBox="0 0 100 100" aria-hidden>` with a `<g className="lg-lines">` of `<line>`s (one per edge) and a `<g className="lg-dots">` of `<circle>`s (radius `2.6` when `i % 3 === 0` else `1.7`). Wrap in a `.brand .mark` container: `export function Logo() { return <span className="mark">{/* svg */}</span> }`.

- [ ] **Step 4: Implement `src/ui/shell/Topbar.tsx`**

```tsx
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
```

- [ ] **Step 5: Implement `src/ui/shell/AppShell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Topbar } from './Topbar'

export function AppShell({
  connected,
  children,
}: {
  connected: boolean
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
      <Topbar connected={connected} />
      <div className="screens">
        <div className="screen">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/ui/shell/Topbar.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 7: Commit**

```bash
git add src/ui/shell
git commit -m "feat(ui): add app shell, topbar, and logo"
```

---

### Task 5: Onboarding — Connect step — `src/ui/onboarding/OnboardingConnect.tsx`

The first wizard card: server-URL field + "test connection", wired to the real `useConnection`.

**Files:**

- Create: `src/ui/onboarding/Steps.tsx` (the `.onb-steps` indicator)
- Create: `src/ui/onboarding/OnboardingConnect.tsx`
- Test: `src/ui/onboarding/OnboardingConnect.test.tsx`

**Interfaces:**

- Consumes: `useI18n` (Task 2); the `useConnection` return shape from `../useConnection` — `{ state: { phase, error, baseUrl, models }, connect(url): Promise<void> }` (existing hook, unchanged). `phase` is `'idle' | 'connecting' | 'connected' | 'ready' | 'error'`.
- Produces:
  - `Steps({ active }: { active: 1 | 2 | 3 }): JSX.Element` — the `.onb-steps` markup from `app/onboarding.js` `steps()`: three `<i>` (class `on` when `index < active`) + a `<span>` with the step label (`t('step_connect' | 'step_model' | 'step_elo')`) and `active/3`.
  - `OnboardingConnect({ conn, onConnected }: { conn: UseConnection; onConnected(): void }): JSX.Element` where `UseConnection = ReturnType<typeof useConnection>`. Renders the `.onb` > `.onb-card` from `app/onboarding.js` `connect()`: brand block, `<Steps active={1} />`, `h2 t('connect_h')`, lede `t('connect_p')`, a `.field` with label `t('connect_url')` and an `.input` pre-filled from `conn.state.baseUrl`, a state area, a primary button, and the `.foot-note t('connect_hint')`.
    - Button label: `t('connect_check')` when idle/error; `t('connect_checking')` while `phase === 'connecting'` (disabled, with a `.spinner`); once `phase === 'connected'` show a success `.pill` (`.live` + `t('connect_ok')`) and the button becomes `t('connect_next')` which calls `onConnected()`.
    - Clicking the button when not yet connected calls `conn.connect(<field value>)`.
    - On `phase === 'error'` render the error text in a `<p role="alert">` (from `conn.state.error`).

- [ ] **Step 1: Write the failing test `src/ui/onboarding/OnboardingConnect.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingConnect } from './OnboardingConnect'
import { I18nProvider } from '../app/i18n'
import { useConnection } from '../useConnection'
import * as client from '../../llm/client'
import type { LMModel } from '../../llm/types'
import { renderHook } from '@testing-library/react'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function setup() {
  const { result } = renderHook(() => useConnection())
  const onConnected = vi.fn()
  const view = render(
    <I18nProvider>
      <OnboardingConnect conn={result.current} onConnected={onConnected} />
    </I18nProvider>,
  )
  return { result, onConnected, view }
}

test('renders the connect card with the default URL', () => {
  setup()
  expect(
    screen.getByRole('heading', { name: 'Подключитесь к LM Studio' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Адрес сервера')).toHaveValue(
    'http://localhost:1234',
  )
})

test('successful connect shows the success pill and advances', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result, onConnected, view } = setup()
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  // re-render with the updated hook state
  view.rerender(
    <I18nProvider>
      <OnboardingConnect conn={result.current} onConnected={onConnected} />
    </I18nProvider>,
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Выбрать модель' }),
    ).toBeInTheDocument(),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Выбрать модель' }))
  expect(onConnected).toHaveBeenCalledTimes(1)
})
```

Note: because `useConnection` is a hook, this test renders it via `renderHook` and passes the live value in; the controlling `App` (Task 8) owns the hook for real. The `view.rerender` mirrors what React does when the hook state updates in the app.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/onboarding/OnboardingConnect.test.tsx`
Expected: FAIL — cannot resolve `./OnboardingConnect`.

- [ ] **Step 3: Implement `src/ui/onboarding/Steps.tsx`**

```tsx
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
```

- [ ] **Step 4: Implement `src/ui/onboarding/OnboardingConnect.tsx`**

```tsx
import { useState } from 'react'
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
  const connected = phase === 'connected'

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
          {connected && (
            <div className="pill">
              <span className="live" />
              {t('connect_ok')}
            </div>
          )}
          {phase === 'error' && error && <p role="alert">{error}</p>}
        </div>
        <div className="onb-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={phase === 'connecting'}
            onClick={() => (connected ? onConnected() : conn.connect(url))}
          >
            {connected ? t('connect_next') : t('connect_check')}
          </button>
        </div>
        <p className="foot-note">{t('connect_hint')}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/onboarding/OnboardingConnect.test.tsx`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/ui/onboarding/Steps.tsx src/ui/onboarding/OnboardingConnect.tsx src/ui/onboarding/OnboardingConnect.test.tsx
git commit -m "feat(ui): add onboarding connect step"
```

---

### Task 6: Onboarding — Models step — `src/ui/onboarding/OnboardingModels.tsx`

The models list styled as `.model-row`, wired to real `useConnection` load/use. Real models carry `{ id, type, state, quantization?, maxContextLength? }` — there is no RAM figure, so the meta row shows type + quant + context (omit RAM).

**Files:**

- Create: `src/ui/onboarding/OnboardingModels.tsx`
- Test: `src/ui/onboarding/OnboardingModels.test.tsx`

**Interfaces:**

- Consumes: `useI18n`; the `useConnection` shape — `{ state: { models: LMModel[], loadingModelId: string | null }, load(id): Promise<void>, use(id): void }`. `LMModel` from `../../llm/types` = `{ id, type, state, quantization?, maxContextLength?, capabilities? }`.
- Produces:
  - `OnboardingModels({ conn, onUse }: { conn: UseConnection; onUse(): void }): JSX.Element` — `.onb` > `.onb-card` (wider) with `<Steps active={2} />`, `h2 t('model_h')`, lede `t('model_p')`, and a `.model-list` of `.model-row` (markup per `app/onboarding.js` `renderModelList()`), one per `conn.state.models`:
    - `.mi` with `<b>{model.id}</b>` and a `.meta` of `<span>` chips: the model `type`, `t('model_q') {quantization}` (only if present), `t('model_ctx') {maxContextLength}` (only if present).
    - `.acts`: when `state === 'loaded'` → a `.tag.tag-accent` `t('loaded')` + a primary button `t('use')` calling `conn.use(model.id)` then `onUse()`; otherwise a secondary button `t('load')` calling `conn.load(model.id)`. While `conn.state.loadingModelId === model.id`, that button shows a `.spinner` + `t('loading')` and is disabled.

- [ ] **Step 1: Write the failing test `src/ui/onboarding/OnboardingModels.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingModels } from './OnboardingModels'
import { I18nProvider } from '../app/i18n'
import type { LMModel } from '../../llm/types'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const models: LMModel[] = [
  {
    id: 'not-loaded-model',
    type: 'llm',
    state: 'not-loaded',
    quantization: 'Q4_K_M',
  },
  { id: 'loaded-model', type: 'vlm', state: 'loaded' },
]

function conn(overrides = {}) {
  return {
    state: { models, loadingModelId: null },
    load: vi.fn(),
    use: vi.fn(),
    ...overrides,
  } as never
}

test('not-loaded row shows Load, loaded row shows the tag and Play', () => {
  render(
    <I18nProvider>
      <OnboardingModels conn={conn()} onUse={() => {}} />
    </I18nProvider>,
  )
  expect(screen.getByText('not-loaded-model')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Загрузить' })).toBeEnabled()
  expect(screen.getByText('В памяти')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Играть' })).toBeInTheDocument()
})

test('Play uses the model then advances', async () => {
  const onUse = vi.fn()
  const c = conn()
  render(
    <I18nProvider>
      <OnboardingModels conn={c} onUse={onUse} />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Играть' }))
  expect(c.use).toHaveBeenCalledWith('loaded-model')
  expect(onUse).toHaveBeenCalledTimes(1)
})

test('Load triggers the real load for that model', async () => {
  const c = conn()
  render(
    <I18nProvider>
      <OnboardingModels conn={c} onUse={() => {}} />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Загрузить' }))
  expect(c.load).toHaveBeenCalledWith('not-loaded-model')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/onboarding/OnboardingModels.test.tsx`
Expected: FAIL — cannot resolve `./OnboardingModels`.

- [ ] **Step 3: Implement `src/ui/onboarding/OnboardingModels.tsx`**

```tsx
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
  const { models, loadingModelId } = conn.state

  return (
    <div className="onb">
      <div className="onb-card" style={{ width: 'min(600px, 100%)' }}>
        <Steps active={2} />
        <h2>{t('model_h')}</h2>
        <p className="lede">{t('model_p')}</p>
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/onboarding/OnboardingModels.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/ui/onboarding/OnboardingModels.tsx src/ui/onboarding/OnboardingModels.test.tsx
git commit -m "feat(ui): add onboarding models step"
```

---

### Task 7: Onboarding — ELO step + placeholder Game screen — `src/ui/onboarding/OnboardingElo.tsx`, `src/ui/game/GamePlaceholder.tsx`

The ELO slider with live band copy, and a minimal Game screen so "start" has a destination (real game is Phase 2).

**Files:**

- Create: `src/ui/onboarding/OnboardingElo.tsx`
- Create: `src/ui/game/GamePlaceholder.tsx`
- Test: `src/ui/onboarding/OnboardingElo.test.tsx`

**Interfaces:**

- Consumes: `useI18n`; `useAppState` (Task 3) for `elo`/`setElo`; `eloBand` (Task 3).
- Produces:
  - `OnboardingElo({ onBack, onStart }: { onBack(): void; onStart(): void }): JSX.Element` — `.onb` > `.onb-card` with `<Steps active={3} />`, `h2 t('elo_h')`, lede `t('elo_p')`, an `.elo-head` (`.elo-num` = elo, `.elo-title` = band title for current lang), a range `input.slider` (min 500, max 1500, step 50, value = elo; on input calls `setElo(+value)` and sets the `--pct` CSS var to `((v-500)/1000)*100 + '%'`), `.elo-ticks` (500/750/1000/1250/1500), an `.elo-quote` (band quote for current lang), and `.onb-actions` with a secondary `t('elo_back')` → `onBack()` and a primary `t('elo_start')` → `onStart()`. Band title/quote pick `lang` from `useI18n().lang` and index `eloBand(elo).ru`/`.en` `[0]`/`[1]`.
  - `GamePlaceholder(): JSX.Element` — a `.game` container with a centered card showing `h2` "NeuroChess" and a `.lede` line (use `t('theirsub')` — "Модель думает…" — as a stand-in message). Minimal; Phase 2 replaces it.

- [ ] **Step 1: Write the failing test `src/ui/onboarding/OnboardingElo.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingElo } from './OnboardingElo'
import { I18nProvider } from '../app/i18n'
import { AppStateProvider } from '../app/appState'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => (
  <I18nProvider>
    <AppStateProvider>{node}</AppStateProvider>
  </I18nProvider>
)

test('shows the default ELO and its band title', () => {
  render(wrap(<OnboardingElo onBack={() => {}} onStart={() => {}} />))
  expect(screen.getByText('1000')).toBeInTheDocument()
  expect(screen.getByText('Уверенный')).toBeInTheDocument()
})

test('moving the slider updates the band', () => {
  render(wrap(<OnboardingElo onBack={() => {}} onStart={() => {}} />))
  const slider = screen.getByRole('slider')
  fireEventChange(slider, '1500')
  expect(screen.getByText('1500')).toBeInTheDocument()
  expect(screen.getByText('Кандидат')).toBeInTheDocument()
})

test('Back and Start call their handlers', async () => {
  const onBack = vi.fn()
  const onStart = vi.fn()
  render(wrap(<OnboardingElo onBack={onBack} onStart={onStart} />))
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await userEvent.click(screen.getByRole('button', { name: 'Начать партию' }))
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(onStart).toHaveBeenCalledTimes(1)
})

// range inputs need a direct value change + input event
function fireEventChange(el: HTMLElement, value: string) {
  const input = el as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/onboarding/OnboardingElo.test.tsx`
Expected: FAIL — cannot resolve `./OnboardingElo`.

- [ ] **Step 3: Implement `src/ui/game/GamePlaceholder.tsx`**

```tsx
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
```

- [ ] **Step 4: Implement `src/ui/onboarding/OnboardingElo.tsx`**

```tsx
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/onboarding/OnboardingElo.test.tsx`
Expected: PASS — 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/ui/onboarding/OnboardingElo.tsx src/ui/game/GamePlaceholder.tsx src/ui/onboarding/OnboardingElo.test.tsx
git commit -m "feat(ui): add onboarding ELO step and placeholder game screen"
```

---

### Task 8: Wire it together in `App` + providers; retire the old dialog

`App` composes the providers, owns `useConnection`, and switches screens through the shell. The old `ConnectionDialog`/`ConnectedView`/`ModelRow`/`ModelList` and their tests are removed; the end-to-end connect→models→elo→game flow is proven.

**Files:**

- Modify: `src/main.tsx` (wrap `<App />` in `<I18nProvider>` + `<AppStateProvider>`)
- Modify: `src/App.tsx` (replace body with the screen switch)
- Modify: `src/App.test.tsx` (replace with the new end-to-end flow test)
- Delete: `src/ui/ConnectionDialog.tsx`, `src/ui/ConnectionDialog.test.tsx`, `src/ui/ModelList.tsx`, `src/ui/ModelRow.tsx`, `src/ui/ModelRow.test.tsx`, `src/ui/ConnectedView.tsx`, `src/ui/ConnectedView.test.tsx`

**Interfaces:**

- Consumes: `useConnection` (unchanged); `useAppState` screen enum (Task 3); `AppShell` (Task 4); `OnboardingConnect` (Task 5), `OnboardingModels` (Task 6), `OnboardingElo` + `GamePlaceholder` (Task 7); `I18nProvider`/`AppStateProvider`.
- Produces: `App(): JSX.Element` that renders `<AppShell connected={phase==='connected' || phase==='ready'}>` around the screen selected by `useAppState().screen`, mapping: `onb-connect`→`OnboardingConnect` (onConnected → `setScreen('onb-models')`), `onb-models`→`OnboardingModels` (onUse → `setScreen('onb-elo')`), `onb-elo`→`OnboardingElo` (onBack → `setScreen('onb-models')`, onStart → `setScreen('game')`), `game`→`GamePlaceholder`, `history`→`GamePlaceholder` (placeholder until Phase 3).

- [ ] **Step 1: Replace `src/App.test.tsx` with the end-to-end flow test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { I18nProvider } from './ui/app/i18n'
import { AppStateProvider } from './ui/app/appState'
import * as client from './llm/client'
import type { LMModel } from './llm/types'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function renderApp() {
  return render(
    <I18nProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </I18nProvider>,
  )
}

test('connect → choose model → ELO → game', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  renderApp()
  // connect
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Выбрать модель' }),
  )
  // models → play the loaded model
  await userEvent.click(await screen.findByRole('button', { name: 'Играть' }))
  // ELO → start
  await userEvent.click(
    await screen.findByRole('button', { name: 'Начать партию' }),
  )
  // game placeholder
  await waitFor(() =>
    expect(screen.getByText('Модель думает…')).toBeInTheDocument(),
  )
})

test('topbar language toggle switches copy on the connect screen', async () => {
  renderApp()
  expect(
    screen.getByRole('heading', { name: 'Подключитесь к LM Studio' }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(
    screen.getByRole('heading', { name: 'Connect to LM Studio' }),
  ).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — old `App` still renders the previous dialog; new imports unresolved.

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { OnboardingElo } from './ui/onboarding/OnboardingElo'
import { GamePlaceholder } from './ui/game/GamePlaceholder'

export default function App() {
  const conn = useConnection()
  const { screen, setScreen } = useAppState()
  const connected =
    conn.state.phase === 'connected' || conn.state.phase === 'ready'

  return (
    <AppShell connected={connected}>
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
      {(screen === 'game' || screen === 'history') && <GamePlaceholder />}
    </AppShell>
  )
}
```

- [ ] **Step 4: Wrap providers in `src/main.tsx`**

Update the render call so `<App />` is wrapped (keep the CSS/font imports from Task 1):

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './ui/app/i18n'
import { AppStateProvider } from './ui/app/appState'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </I18nProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Delete the retired components and tests**

```bash
git rm src/ui/ConnectionDialog.tsx src/ui/ConnectionDialog.test.tsx \
       src/ui/ModelList.tsx src/ui/ModelRow.tsx src/ui/ModelRow.test.tsx \
       src/ui/ConnectedView.tsx src/ui/ConnectedView.test.tsx
```

- [ ] **Step 6: Run the flow test + full gate**

Run: `npx vitest run src/App.test.tsx` then `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: App flow 2 passed; whole gate green. Fix any format/lint/type issues (run `npm run format` if `format:check` flags files).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat(ui): wire onboarding wizard into App, retire old dialog"
```

---

## Self-Review

**Spec coverage (Phase 1 rows):**

- Vendor Nocturne CSS + remove Google-Fonts import + local Inter → Task 1. ✓
- i18n RU/EN + persistence → Task 2. ✓
- App state (screen enum, elo) + demo ELO bands → Task 3. ✓
- Window chrome + topbar (brand, pill, RU/EN); tabs/appearance deferred → Task 4. ✓
- Onboarding Connect wired to real `useConnection` → Task 5. ✓
- Onboarding Models wired (load=spinner, use→advance; real model meta mapping) → Task 6. ✓
- Onboarding ELO (slider + band copy) → Task 7. ✓
- Placeholder Game so "start" lands somewhere → Task 7. ✓
- App screen switch; retire old ConnectionDialog/ConnectedView → Task 8. ✓
- Module boundary (no fetch in ui) — components take `conn`/props; network via `useConnection` only. ✓
- No real network in tests — App/onboarding tests mock `src/llm/client`; presentational tests pass a stub `conn`. ✓

**Placeholder scan:** No TBD/"handle X". Markup/copy references point to concrete on-disk vendored files (exact source), and every code/test step shows full code. ✓

**Type consistency:** `Lang`/`TKey`/`STRINGS` (Task 2) used in Tasks 4–8. `Screen` + `useAppState` (Task 3) used in Task 8. `UseConnection = ReturnType<typeof useConnection>` and `state.{phase,error,baseUrl,models,loadingModelId}` + `connect/load/use` match the existing hook (from the prior spec) and are used identically in Tasks 5–6, 8. `eloBand`/`ELO_BANDS` (Task 3) used in Task 7. `Steps` props `{active:1|2|3}` consistent across Tasks 5–7. Component prop shapes (`conn`, `onConnected`, `onUse`, `onBack`, `onStart`) match their call sites in Task 8. ✓

**Note for executor:** `useConnection` currently lives at `src/ui/useConnection.ts` and exposes `{ state:{ baseUrl, phase, models, loadingModelId, activeModel, error }, connect, load, use, reset }` — Tasks 5/6/8 rely on that exact shape; do not change the hook in Phase 1.
