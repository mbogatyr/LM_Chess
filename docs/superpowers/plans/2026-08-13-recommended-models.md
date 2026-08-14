# Recommended Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Recommended models" button on the onboarding model list opening a ranked popup of the three tested models, plus a yellow star next to those models in the LM Studio list, driven by a JSON rating file.

**Architecture:** Rating data is one self-contained JSON (`recommendedModels.json`, RU/EN comments included) read by a pure helper (`recommended.ts`: sorted list + `findRecommendation` with LM Studio `:N` instance-suffix normalization). A scrim dialog component (`RecommendedModelsDialog`, PromotionPicker pattern) renders the list; `OnboardingModels` gains a header-row button and per-row stars.

**Tech Stack:** React 18 + TS strict, Vitest + Testing Library (jsdom), Vite native JSON import (`resolveJsonModule` already on), CSS in `src/styles/app.css`.

**Spec:** `docs/superpowers/specs/2026-08-13-recommended-models-design.md`

## Global Constraints

- Work on branch `feat/recommended-models` (never on `main`).
- Prettier: no semicolons, single quotes, trailing commas, 80 col. Run `npm run format` before each commit.
- TypeScript strict — no `any`.
- All UI copy through i18n (RU/EN); rating comments live in the JSON, not in `i18n.tsx`.
- Star marks EXACTLY the tested ids (`chesslm-0.01-llama-3.1-8b`, `qwen/qwen3.5-9b`, `google/gemma-4-12b`); `google/gemma-4-12b-qat` and `google/gemma-4-e4b` must NOT match.
- No percentages/metrics in the UI — rank + comment only.
- Quality gate before finishing: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

### Task 1: Rating data + `findRecommendation` helper

**Files:**

- Create: `src/ui/onboarding/recommendedModels.json`
- Create: `src/ui/onboarding/recommended.ts`
- Test: `src/ui/onboarding/recommended.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `recommendedModels: RecommendedModel[]` (sorted by `rank` ascending) and `findRecommendation(modelId: string): RecommendedModel | undefined`, both exported from `src/ui/onboarding/recommended.ts`. `RecommendedModel = { rank: number; ids: string[]; name: string; comment: { ru: string; en: string } }`. Tasks 2 and 3 import these.

- [ ] **Step 1: Write the failing test**

Create `src/ui/onboarding/recommended.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { findRecommendation, recommendedModels } from './recommended'

test('lists exactly three models sorted by rank', () => {
  expect(recommendedModels.map((m) => m.rank)).toEqual([1, 2, 3])
})

test('finds each tested id exactly', () => {
  expect(findRecommendation('chesslm-0.01-llama-3.1-8b')?.rank).toBe(1)
  expect(findRecommendation('qwen/qwen3.5-9b')?.rank).toBe(2)
  expect(findRecommendation('google/gemma-4-12b')?.rank).toBe(3)
})

test('normalizes an LM Studio instance suffix', () => {
  expect(findRecommendation('chesslm-0.01-llama-3.1-8b:2')?.rank).toBe(1)
})

test('does not match untested variants or unknown models', () => {
  expect(findRecommendation('google/gemma-4-12b-qat')).toBeUndefined()
  expect(findRecommendation('google/gemma-4-e4b')).toBeUndefined()
  expect(findRecommendation('qwen2.5-7b-instruct-1m')).toBeUndefined()
  expect(findRecommendation('')).toBeUndefined()
})

test('every entry carries both comment languages', () => {
  for (const m of recommendedModels) {
    expect(m.comment.ru.length).toBeGreaterThan(0)
    expect(m.comment.en.length).toBeGreaterThan(0)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/onboarding/recommended.test.ts`
Expected: FAIL — cannot resolve `./recommended`.

- [ ] **Step 3: Create the JSON**

Create `src/ui/onboarding/recommendedModels.json` (content verbatim; ranking basis — GM-move match 12% / 10.7% / 9.8% — is documented in the spec, not shown in UI):

```json
{
  "updated": "2026-08-13",
  "models": [
    {
      "rank": 1,
      "ids": ["chesslm-0.01-llama-3.1-8b"],
      "name": "chessLM 0.01 (Llama 3.1 8B)",
      "comment": {
        "ru": "Шахматный файнтьюн — уверенная дебютная теория, слабеет после ~20 ходов.",
        "en": "Chess finetune — solid opening theory, weakens after ~20 moves."
      }
    },
    {
      "rank": 2,
      "ids": ["qwen/qwen3.5-9b"],
      "name": "Qwen3.5 9B",
      "comment": {
        "ru": "Универсальная reasoning-модель; двухступенчатый промпт даёт приличную игру.",
        "en": "General reasoning model; a two-stage prompt gets decent play out of it."
      }
    },
    {
      "rank": 3,
      "ids": ["google/gemma-4-12b"],
      "name": "Gemma 4 12B",
      "comment": {
        "ru": "Надёжнее всех держится в рамках легальных ходов, играет проще.",
        "en": "Most reliable at staying legal, plays the plainest chess."
      }
    }
  ]
}
```

- [ ] **Step 4: Create the helper**

Create `src/ui/onboarding/recommended.ts`:

```typescript
import data from './recommendedModels.json'

// The curated rating of models tested in real games — see
// docs/superpowers/specs/2026-08-13-recommended-models-design.md for the
// measured numbers behind the ranks (kept out of the UI on purpose).
export type RecommendedModel = {
  rank: number
  ids: string[]
  name: string
  comment: { ru: string; en: string }
}

export const recommendedModels: RecommendedModel[] = [...data.models].sort(
  (a, b) => a.rank - b.rank,
)

// LM Studio appends ":N" to extra instances of the same model
// (e.g. "chesslm-0.01-llama-3.1-8b:2") — strip it before the exact match.
export function findRecommendation(
  modelId: string,
): RecommendedModel | undefined {
  const id = modelId.replace(/:\d+$/, '')
  return recommendedModels.find((m) => m.ids.includes(id))
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/onboarding/recommended.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/ui/onboarding/recommendedModels.json src/ui/onboarding/recommended.ts src/ui/onboarding/recommended.test.ts
git commit -m "feat: recommended-models rating data and lookup helper"
```

---

### Task 2: i18n keys + `RecommendedModelsDialog`

**Files:**

- Modify: `src/ui/app/i18n.tsx` (add 5 keys to BOTH the `ru` and `en` string objects — RU keys sit near `model_h`/`model_p` around line 39, EN near line 166)
- Create: `src/ui/onboarding/RecommendedModelsDialog.tsx`
- Modify: `src/styles/app.css` (dialog + star styles)
- Test: `src/ui/onboarding/RecommendedModelsDialog.test.tsx`

**Interfaces:**

- Consumes: `recommendedModels` from `./recommended` (Task 1); `useI18n` from `../app/i18n` (`t(key)`, `lang: 'ru' | 'en'`).
- Produces: `RecommendedModelsDialog({ onClose }: { onClose: () => void })`, exported from `src/ui/onboarding/RecommendedModelsDialog.tsx`; i18n keys `rec_btn`, `rec_h`, `rec_p`, `rec_close`, `rec_star`; CSS classes `.rec-scrim`, `.rec-card`, `.rec-row`, `.rec-rank`, `.model-star`. Task 3 uses `rec_btn`, `rec_star`, `.model-star` and renders this dialog.

- [ ] **Step 1: Add the i18n keys**

In `src/ui/app/i18n.tsx`, after the `model_q` line in the **ru** object add:

```typescript
    rec_btn: 'Рекомендуемые модели',
    rec_h: 'Проверенные модели',
    rec_p: 'Эти модели проверены в реальных партиях — от лучшей к худшей.',
    rec_close: 'Закрыть',
    rec_star: 'рекомендуемая модель',
```

After the `model_q` line in the **en** object add:

```typescript
    rec_btn: 'Recommended models',
    rec_h: 'Tested models',
    rec_p: 'These models were tested in real games — best first.',
    rec_close: 'Close',
    rec_star: 'recommended model',
```

(TKey is derived from the ru object, so adding both keeps the types aligned; `npm run typecheck` fails if one side is missing.)

- [ ] **Step 2: Write the failing tests**

Create `src/ui/onboarding/RecommendedModelsDialog.test.tsx`:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RecommendedModelsDialog } from './RecommendedModelsDialog'
import { I18nProvider } from '../app/i18n'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderDialog(onClose = vi.fn()) {
  render(
    <I18nProvider>
      <RecommendedModelsDialog onClose={onClose} />
    </I18nProvider>,
  )
  return onClose
}

test('renders the three models in rank order with RU comments by default', () => {
  renderDialog()
  const dialog = screen.getByRole('dialog')
  const rows = within(dialog).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent('chessLM 0.01 (Llama 3.1 8B)')
  expect(rows[0]).toHaveTextContent('№1')
  expect(rows[0]).toHaveTextContent('дебютная теория')
  expect(rows[1]).toHaveTextContent('Qwen3.5 9B')
  expect(rows[2]).toHaveTextContent('Gemma 4 12B')
})

test('shows EN comments when the stored language is en', () => {
  localStorage.setItem('nocturne-chess', JSON.stringify({ lang: 'en' }))
  renderDialog()
  expect(screen.getByText(/opening theory/)).toBeInTheDocument()
})

test('Escape closes the dialog', async () => {
  const onClose = renderDialog()
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('scrim click closes, card click does not', async () => {
  const onClose = renderDialog()
  await userEvent.click(screen.getByText('chessLM 0.01 (Llama 3.1 8B)'))
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('dialog'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Close button closes the dialog', async () => {
  const onClose = renderDialog()
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
```

(The storage key `nocturne-chess` and the `{ lang }` shape match `STORAGE_KEY`/`writeLang` in `src/ui/app/i18n.tsx:270-281` — verified at plan time.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/ui/onboarding/RecommendedModelsDialog.test.tsx`
Expected: FAIL — cannot resolve `./RecommendedModelsDialog`.

- [ ] **Step 4: Implement the dialog**

Create `src/ui/onboarding/RecommendedModelsDialog.tsx`:

```typescript
import { useEffect } from 'react'
import { useI18n } from '../app/i18n'
import { recommendedModels } from './recommended'

export function RecommendedModelsDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const { t, lang } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="rec-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t('rec_h')}
      onClick={onClose}
    >
      <div className="rec-card" onClick={(e) => e.stopPropagation()}>
        <h3>{t('rec_h')}</h3>
        <p className="lede">{t('rec_p')}</p>
        <ul className="rec-list">
          {recommendedModels.map((m) => (
            <li className="rec-row" key={m.rank}>
              <span className="rec-rank">№{m.rank}</span>
              <span className="model-star" aria-hidden="true">
                ★
              </span>
              <div>
                <b>{m.name}</b>
                <p>{m.comment[lang]}</p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('rec_close')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add the CSS**

In `src/styles/app.css`, after the `.promo-btn:hover` block (~line 1106), add:

```css
/* recommended-models dialog (full-screen scrim over the onboarding card) */
.rec-scrim {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-bg) 68%, transparent);
}
.rec-card {
  width: min(480px, calc(100% - 2 * var(--space-4)));
  background: var(--color-surface);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.rec-card h3 {
  margin: 0;
}
.rec-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.rec-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.rec-row p {
  margin: 0;
  color: var(--color-neutral-400);
  font-size: 13px;
}
.rec-rank {
  color: var(--color-neutral-500);
  font-size: 12px;
  min-width: 26px;
}
.model-star {
  color: #f5c542;
  margin-left: var(--space-1);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ui/onboarding/RecommendedModelsDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Format, lint, typecheck, commit**

```bash
npm run format
npm run lint
npm run typecheck
git add src/ui/app/i18n.tsx src/ui/onboarding/RecommendedModelsDialog.tsx src/ui/onboarding/RecommendedModelsDialog.test.tsx src/styles/app.css
git commit -m "feat: recommended-models dialog with i18n and styles"
```

---

### Task 3: Wire the button and stars into `OnboardingModels`

**Files:**

- Modify: `src/ui/onboarding/OnboardingModels.tsx`
- Modify: `src/styles/app.css` (header row)
- Test: `src/ui/onboarding/OnboardingModels.test.tsx` (extend)

**Interfaces:**

- Consumes: `findRecommendation` from `./recommended` (Task 1); `RecommendedModelsDialog` from `./RecommendedModelsDialog` and i18n keys `rec_btn`/`rec_star` (Task 2).
- Produces: final UI behavior; nothing downstream.

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/onboarding/OnboardingModels.test.tsx` (the existing `models` fixture has ids `not-loaded-model` and `loaded-model` — extend the fixture with a tested id):

```typescript
const modelsWithTested: LMModel[] = [
  ...models,
  {
    id: 'chesslm-0.01-llama-3.1-8b',
    type: 'llm',
    state: 'not-loaded',
    quantization: 'Q4_K_M',
  },
]

test('tested models get a star, others do not', () => {
  render(
    <I18nProvider>
      <OnboardingModels
        conn={conn({ state: { models: modelsWithTested, loadingModelId: null } })}
        onUse={() => {}}
      />
    </I18nProvider>,
  )
  const testedRow = screen.getByText('chesslm-0.01-llama-3.1-8b').closest('.model-row')
  const plainRow = screen.getByText('not-loaded-model').closest('.model-row')
  expect(testedRow?.querySelector('.model-star')).not.toBeNull()
  expect(plainRow?.querySelector('.model-star')).toBeNull()
})

test('Recommended models button opens and closes the dialog', async () => {
  render(
    <I18nProvider>
      <OnboardingModels conn={conn()} onUse={() => {}} />
    </I18nProvider>,
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Рекомендуемые модели' }),
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/onboarding/OnboardingModels.test.tsx`
Expected: the two new tests FAIL (no star, no button); existing tests still pass.

- [ ] **Step 3: Implement**

In `src/ui/onboarding/OnboardingModels.tsx`:

1. Add imports and state:

```typescript
import { useState } from 'react'
import { findRecommendation } from './recommended'
import { RecommendedModelsDialog } from './RecommendedModelsDialog'
```

and inside the component: `const [showRecommended, setShowRecommended] = useState(false)`.

2. Replace `<h2>{t('model_h')}</h2>` with a header row:

```tsx
<div className="onb-head">
  <h2>{t('model_h')}</h2>
  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => setShowRecommended(true)}
  >
    {t('rec_btn')}
  </button>
</div>
```

3. Replace `<b>{model.id}</b>` with:

```tsx
<b>
  {model.id}
  {findRecommendation(model.id) && (
    <span className="model-star" role="img" aria-label={t('rec_star')}>
      ★
    </span>
  )}
</b>
```

4. Before the closing `</div>` of `.onb-card`, render the dialog:

```tsx
{
  showRecommended && (
    <RecommendedModelsDialog onClose={() => setShowRecommended(false)} />
  )
}
```

5. In `src/styles/app.css`, next to the `.onb-card h2` rule (~line 794), add:

```css
.onb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.onb-head h2 {
  margin: 0;
}
```

- [ ] **Step 4: Run the onboarding suite**

Run: `npx vitest run src/ui/onboarding`
Expected: PASS — new tests green, existing OnboardingModels/Connect/Elo/Steps tests untouched and green.

- [ ] **Step 5: Full quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/onboarding/OnboardingModels.tsx src/ui/onboarding/OnboardingModels.test.tsx src/styles/app.css
git commit -m "feat: recommended-models button and star badges in the model list"
```

---

### Task 4: Documentation

**Files:**

- Modify: `CLAUDE.md` — in "## Project structure", the `onboarding/` line: mention the recommended-models feature, e.g. append "; Models step has a «Recommended models» button (RecommendedModelsDialog) + yellow star badges for tested models, driven by recommendedModels.json (curated rating, RU/EN comments in the file — see the 2026-08-13 recommended-models spec)".

**Interfaces:** none — docs only.

- [ ] **Step 1: Update CLAUDE.md, run `npm run format` (CI prettier-checks Markdown)**

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note the recommended-models feature in CLAUDE.md"
```
