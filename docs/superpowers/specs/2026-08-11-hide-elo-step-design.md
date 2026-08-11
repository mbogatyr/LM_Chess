# Hide the ELO onboarding step

Date: 2026-08-11
Status: Design (approved by user, pending spec review)

## Context

The onboarding wizard is Connect → Models → ELO. The Prompt Lab campaigns
(docs/prompt-lab/, 2026-08-11) measured that the ELO persona line in the
move-selection prompt moves match rate only within statistical noise, and
the qwen3.5 adapter's first-attempt prompt (raw PGN completion) cannot
express an ELO at all. The user's verdict: the strength dial no longer
meaningfully affects play — **hide the step, but keep the code** (not a
deletion; the setting may return when a future model or prompt actually
honors it).

### What exists today (relevant surfaces)

- `src/App.tsx` — screen router: `onb-models`'s `onUse` navigates to
  `'onb-elo'`; an `{screen === 'onb-elo' && <OnboardingElo …>}` branch
  renders the step.
- `src/ui/onboarding/OnboardingElo.tsx` (+ test) — the presentational ELO
  step; renders `<Steps active={3} />`.
- `src/ui/onboarding/Steps.tsx` — fixed three-dot indicator:
  `KEYS = ['step_connect', 'step_model', 'step_elo']`, `active: 1 | 2 | 3`,
  caption `<label> · N/3`.
- `src/ui/app/appState.tsx` — `elo` state, persisted to localStorage,
  default **1000**; `'onb-elo'` is a member of the `Screen` union.
- `src/ui/app/i18n.tsx` — models-screen helper copy references the removed
  step: EN "This model will be your opponent. Its strength follows the ELO
  level you set — that's the next step." (and the RU equivalent);
  `step_elo` key ('Уровень'/'Level').
- `elo` still flows: `App` → `GameScreen` → `useGame` → `selectMove` →
  adapter prompts (genericFen and gemma4 persona lines, qwen35 retry stage),
  and into `useHint`.

## Decisions (from brainstorming)

1. **Route around, don't gate.** The wizard becomes two steps by routing
   `onUse` directly to `'game'` and dropping the `onb-elo` render branch —
   no feature flag. Git history plus the intact component file are the
   "keep" mechanism.
2. **Hidden means compiling and tested.** `OnboardingElo.tsx` and its test
   file stay in the tree and stay green. `'onb-elo'` stays in the `Screen`
   union. `step_elo` stays in i18n.
3. **The `elo` state stays wired.** appState keeps persisting it; the
   stored (or default 1000) value keeps flowing into prompts and hints.
   No behavioral change outside onboarding.
4. **The step indicator must not lie.** `Steps` shrinks to two entries;
   captions read `N/2`.

## Changes

| File                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                         | `OnboardingModels`'s `onUse` → `setScreen('game')`; delete the `onb-elo` render branch and the `OnboardingElo` import.                                                                                                                                                                                                                                                                                                                                |
| `src/ui/onboarding/Steps.tsx`         | `KEYS = ['step_connect', 'step_model']`; `active: 1 \| 2`; caption `· N/2` (derive the total from `KEYS.length`, no hardcoded 3).                                                                                                                                                                                                                                                                                                                     |
| `src/ui/onboarding/OnboardingElo.tsx` | Only `active={3}` → `active={2}` so the hidden component compiles against the new `Steps` type. Everything else untouched.                                                                                                                                                                                                                                                                                                                            |
| `src/ui/app/i18n.tsx`                 | **No change.** Verified at plan time: the ELO-next-step sentence lives in the `confirm_*` keys, which no component renders (a prototype leftover); the visible models-screen copy (`model_p`) never mentions ELO. Dead keys stay untouched per "hide, don't delete".                                                                                                                                                                                   |
| Tests                                 | Update: `src/App.test.tsx`'s end-to-end wizard test `'connect → choose model → ELO → game'` (drops the ELO leg: Use lands directly on the game screen; rename accordingly), `Steps` expectations if any assert dot count or `N/3`, and any copy assertion on the models helper text. `OnboardingModels.test.tsx` needs no change (it spies `onUse`, not the destination). `OnboardingElo.test.tsx` stays as-is (it does not assert the step counter). |

No changes to `appState`, `useGame`, `selectMove`, adapters, or `GameScreen`.

## Error handling

None new — this is routing plus presentational copy. A stale persisted
`screen` value cannot occur (screen state is not persisted; every session
starts at `onb-connect`).

## Testing

- Existing suites must stay green, including `OnboardingElo.test.tsx`
  (proves the hidden code still works).
- Updated: `App.test.tsx`/models flow — clicking "Use" lands on the game
  screen; `Steps` renders two dots and `· 1/2` / `· 2/2`.
- The full local gate (`lint / format:check / typecheck / test / build`)
  before pushing; feature branch `feat/hide-elo-step` + PR per project
  convention.

## Out of scope

- Deleting `OnboardingElo`, the `elo` state, or the `step_elo` i18n key.
- Any change to how `elo` feeds prompts/hints (default 1000 or the value a
  user set before this change keeps flowing).
- The Appearance screen (still deferred) and any other onboarding rework.
