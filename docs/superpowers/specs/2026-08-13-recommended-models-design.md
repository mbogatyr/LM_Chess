# Recommended Models — Design

**Date:** 2026-08-13
**Status:** Approved
**Scope:** A "Recommended model" button on the onboarding model-selection screen opening a popup with the three tested models and their relative ranking; a yellow star next to rated models in the LM Studio model list. Rating data lives in a JSON file in the repo.

## Background

Three models now have tuned per-model adapters and measured play quality (GM-move match on the prompt-lab benchmark): chessLM 12% (live eval n=100, 2026-08-13), qwen3.5-9b 10.7% (campaign n=600), gemma-4-12b 9.8% (campaign n=600); random play is ~3–4%. The onboarding list gives no hint which of the LM Studio models actually play well. Decisions (2026-08-13, with the user):

- The star marks **exactly the tested ids** — not every model an adapter's matcher covers. `google/gemma-4-12b-qat` and `google/gemma-4-e4b` get no star.
- The popup shows **place + comment only** — no percentages. The numbers stay in `docs/prompt-lab/` and this spec.
- Button placement: in the header row of the "Choose a model" card, to the right of the `h2` (user's screenshot).

## Data: `src/ui/onboarding/recommendedModels.json`

The whole rating in one self-contained file (comments carried in both languages here, not in `i18n.tsx`):

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

Ranking basis (documented here, not shown in UI): GM-move match 12% / 10.7% / 9.8%. `ids` is an array to allow future aliases of the same tested model. Vite imports JSON natively with an inferred type; no schema library.

## Helper: `src/ui/onboarding/recommended.ts`

- `export type RecommendedModel` — the JSON entry shape (rank, ids, name, comment.ru/comment.en).
- `export const recommendedModels: RecommendedModel[]` — the JSON's `models`, sorted by `rank` (defensive sort; the file is already ordered).
- `export function findRecommendation(modelId: string): RecommendedModel | undefined` — normalizes the id by stripping an LM Studio instance suffix (`:N` at the end, e.g. `chesslm-0.01-llama-3.1-8b:2`), then exact-matches against each entry's `ids`.

Pure module — no React, no network.

## Popup: `src/ui/onboarding/RecommendedModelsDialog.tsx`

Follows the `PromotionPicker` dialog pattern:

- Full-screen scrim, `role="dialog"`, `aria-modal="true"`; closes on Escape, scrim click, and a "Close" button. Card click does not close (stopPropagation).
- Content: title + short lede + one row per `recommendedModels` entry: `№{rank}`, a yellow star, the model `name`, and `comment[lang]` for the current i18n language.
- Props: `{ onClose: () => void }`. No other state.

## Screen changes: `src/ui/onboarding/OnboardingModels.tsx`

- Header becomes a row: `h2` + a `btn btn-secondary` button on the right (label from i18n). Clicking sets local state `showRecommended`; the dialog renders while true.
- In each model row, if `findRecommendation(model.id)` matches, render a star `<span className="model-star" role="img" aria-label={t('rec_star')}>★</span>` right after the `<b>{model.id}</b>`.

## i18n keys (RU/EN) in `src/ui/app/i18n.tsx`

- `rec_btn`: «Рекомендуемые модели» / "Recommended models"
- `rec_h`: «Проверенные модели» / "Tested models"
- `rec_p`: «Эти модели проверены в реальных партиях — от лучшей к худшей.» / "These models were tested in real games — best first."
- `rec_close`: «Закрыть» / "Close"
- `rec_star`: «рекомендуемая модель» / "recommended model" (star aria-label)

## CSS (`src/styles/app.css`)

- `.onb-head` — flex row for h2 + button (space-between, baseline-aligned).
- `.model-star` — `color: #f5c542`, small left margin.
- `.rec-scrim` / `.rec-card` — dialog scrim + card, reusing the existing dark-card variables/patterns (`.onb-card` visual language); `.rec-row` with rank, star, name (bold) and comment (muted).

## Testing

- `recommended.test.ts`: exact match for each tested id; `:2` instance suffix matches; `google/gemma-4-12b-qat`, `google/gemma-4-e4b`, unknown ids do not match; list sorted by rank.
- `RecommendedModelsDialog.test.tsx`: renders 3 rows in rank order; shows RU comment under RU locale and EN under EN; Escape and scrim click call `onClose`; card click does not.
- `OnboardingModels.test.tsx` (extend): star rendered for a tested model id, absent for others; the button opens the dialog; closing hides it.

## Out of scope

- No percentages/metrics in the UI.
- No changes to adapters, game screen, or history.
- No auto-generation of the JSON from prompt-lab results (manual curation).
