# chessLM Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `ModelAdapter` for `chesslm-0.01-llama-3.1-8b` (Alpaca-format completion prompt from the model's HuggingFace card), plus extraction of the shared first-mentioned-first SAN parser.

**Architecture:** New pure adapter `src/llm/adapters/chessLm.ts` (build Alpaca completion prompt / parse SAN candidates), registered in the existing `ADAPTERS` list in `src/llm/adapters/index.ts`. The `parseFirstSan` helper currently private to `qwen35.ts` moves to a new shared `src/llm/adapters/parseSan.ts`. No transport, engine, or UI changes — `selectMove` picks the adapter up automatically.

**Tech Stack:** TypeScript 5 strict, Vitest (jsdom, globals), existing `src/engine` test fixtures (`newGame`/`move`/`legalMoves`).

**Spec:** `docs/superpowers/specs/2026-08-13-chesslm-adapter-design.md`

## Global Constraints

- Work on branch `feat/chesslm-adapter` (never on `main`).
- Prettier config: no semicolons, single quotes, trailing commas, 80 col. Run `npm run format` before each commit.
- TypeScript strict — no `any`.
- Unit tests must not touch the network; the adapter is pure (build/parse only).
- Adapters must not import from `src/ui`.
- Quality gate before finishing: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

### Task 1: Extract `parseFirstSan` into a shared `parseSan.ts`

**Files:**

- Create: `src/llm/adapters/parseSan.ts`
- Create: `src/llm/adapters/parseSan.test.ts`
- Modify: `src/llm/adapters/qwen35.ts` (delete the local `SAN_RE` + `parseFirstSan`, import instead)

**Interfaces:**

- Consumes: nothing new.
- Produces: `parseFirstSan(reply: string): string[]` and `SAN_RE: RegExp`, exported from `src/llm/adapters/parseSan.ts`. Task 2 imports `parseFirstSan` from there. Behavior is identical to the current `qwen35.ts` implementation (all SAN-shaped tokens, order of first mention, deduplicated).

- [ ] **Step 1: Write the failing test**

Create `src/llm/adapters/parseSan.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { parseFirstSan } from './parseSan'

test('returns SAN tokens in order of first mention', () => {
  expect(parseFirstSan(' Nf3 Nc6 3. Bb5')).toEqual(['Nf3', 'Nc6', 'Bb5'])
})

test('deduplicates repeated moves', () => {
  expect(parseFirstSan('e4 e4 e5')).toEqual(['e4', 'e5'])
})

test('recognises castling, captures, promotion, check and mate suffixes', () => {
  expect(parseFirstSan('O-O-O')).toContain('O-O-O')
  expect(parseFirstSan('Qxd5+')).toContain('Qxd5+')
  expect(parseFirstSan('e8=Q#')).toContain('e8=Q#')
})

test('returns an empty list for a reply with no SAN-shaped tokens', () => {
  expect(parseFirstSan('I resign!')).toEqual([])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/adapters/parseSan.test.ts`
Expected: FAIL — cannot resolve `./parseSan`.

- [ ] **Step 3: Create `src/llm/adapters/parseSan.ts` (moved verbatim from `qwen35.ts:63-73`)**

```typescript
export const SAN_RE =
  /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

// First-mentioned first: a completion continues the movetext, so the first
// token IS the move (later tokens are the model continuing the game).
export function parseFirstSan(reply: string): string[] {
  const out: string[] = []
  for (const m of reply.matchAll(SAN_RE)) {
    if (!out.includes(m[0])) out.push(m[0])
  }
  return out
}
```

- [ ] **Step 4: Point `qwen35.ts` at the shared module**

In `src/llm/adapters/qwen35.ts`:

- Add `import { parseFirstSan } from './parseSan'` to the imports.
- Delete the local `const SAN_RE = ...` and the `export function parseFirstSan(...)` block (lines 63–73). Keep the section comment header above them out too — `parseSan.ts` now carries the explanation.

- [ ] **Step 5: Run the full adapter suite to verify nothing broke**

Run: `npx vitest run src/llm/adapters`
Expected: PASS — `parseSan.test.ts` green, `qwen35.test.ts` unchanged and green.

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/llm/adapters/parseSan.ts src/llm/adapters/parseSan.test.ts src/llm/adapters/qwen35.ts
git commit -m "refactor: extract shared first-mentioned SAN parser from qwen35 adapter"
```

---

### Task 2: The chessLM adapter

**Files:**

- Create: `src/llm/adapters/chessLm.ts`
- Create: `src/llm/adapters/chessLm.test.ts`

**Interfaces:**

- Consumes: `parseFirstSan` from `./parseSan` (Task 1); `toSanMoveChain`, `toLegalSan` from `./encoding`; `ModelAdapter`, `ModelRequest`, `MoveContext` from `./types`.
- Produces: `chessLmAdapter: ModelAdapter` with `name: 'chesslm-alpaca'`, exported from `src/llm/adapters/chessLm.ts`. Task 3 registers it.

- [ ] **Step 1: Write the failing tests**

Create `src/llm/adapters/chessLm.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { newGame, legalMoves, move } from '../../engine/game'
import { chessLmAdapter } from './chessLm'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('matches the LM Studio chessLM model id', () => {
  expect(chessLmAdapter.matches('chesslm-0.01-llama-3.1-8b')).toBe(true)
})

test('matches case-insensitively (HF repo casing)', () => {
  expect(chessLmAdapter.matches('ippity/chessLM-0.01-llama-3.1-8b')).toBe(true)
})

test('does not match unrelated model ids', () => {
  expect(chessLmAdapter.matches('qwen/qwen3.5-9b')).toBe(false)
  expect(chessLmAdapter.matches('google/gemma-4-12b')).toBe(false)
  expect(chessLmAdapter.matches('llama-3.1-8b-instruct')).toBe(false)
})

test('builds the documented Alpaca completion prompt verbatim', () => {
  const s1 = move(newGame(), 'e4')
  if (!s1) throw new Error('illegal in fixture')
  const legal = legalMoves(s1)
  const req = chessLmAdapter.buildRequest(ctx({ state: s1, legal }))
  expect(req.kind).toBe('completion')
  if (req.kind !== 'completion') return
  expect(req.prompt).toBe(
    'Below is an instruction that describes a task, paired with an input ' +
      'that provides further context. Write a response that appropriately ' +
      'completes the request.\n\n' +
      '### Instruction:\n' +
      'Given the moves so far in a chess game, predict the subsequent ' +
      'moves until the end of the game.\n\n' +
      '### Input:\n' +
      'Moves so far: e4\n' +
      `Legal moves: ${legal.map((m) => m.san).join(' ')}\n\n` +
      '### Response:\n',
  )
})

test('renders an empty move history as an empty value', () => {
  const req = chessLmAdapter.buildRequest(ctx())
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).toContain('Moves so far: \n')
})

test('retry stays a completion and appends the correction note to the input', () => {
  const req = chessLmAdapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  expect(req.kind).toBe('completion')
  if (req.kind !== 'completion') return
  expect(req.prompt).toContain(
    'Note: "Qzz9" was not a legal move. Choose one move from the legal ' +
      'moves list.',
  )
  expect(req.prompt.endsWith('### Response:\n')).toBe(true)
})

test('no correction note on the first attempt', () => {
  const req = chessLmAdapter.buildRequest(ctx())
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).not.toContain('Note:')
})

test('truncates a rambling badReply in the correction note', () => {
  const badReply = 'x'.repeat(500)
  const req = chessLmAdapter.buildRequest(
    ctx({ correction: { badReply, reason: 'illegal' } }),
  )
  if (req.kind !== 'completion') throw new Error('expected completion')
  expect(req.prompt).not.toContain(badReply)
  expect(req.prompt).toContain(`"${'x'.repeat(80)}…"`)
})

test('parseMoves takes SAN candidates in order of first mention', () => {
  expect(chessLmAdapter.parseMoves('e5 Nf3 Nc6', ctx())).toEqual([
    'e5',
    'Nf3',
    'Nc6',
  ])
})

test('parseMoves returns an empty list for garbage', () => {
  expect(chessLmAdapter.parseMoves('???', ctx())).toEqual([])
})

test('sampling is deterministic, short, and not a reasoning model', () => {
  expect(chessLmAdapter.sampling).toEqual({ temperature: 0, maxTokens: 32 })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/llm/adapters/chessLm.test.ts`
Expected: FAIL — cannot resolve `./chessLm`.

- [ ] **Step 3: Implement `src/llm/adapters/chessLm.ts`**

```typescript
import { toLegalSan, toSanMoveChain } from './encoding'
import { parseFirstSan } from './parseSan'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// ippity/chessLM-0.01-llama-3.1-8b — a Llama 3.1 8B finetuned on
// Alpaca-style chess prompts (see the HuggingFace model card, quoted
// verbatim in docs/superpowers/specs/2026-08-13-chesslm-adapter-design.md).
// The finetune fixes the prompt format, so this adapter reproduces it
// exactly: raw completion (the model has no chat template — LM Studio's
// chat endpoint would wrap the text in a Llama template it was never
// trained on), SAN move history plus the legal-move list, response
// terminator `### Response:\n`. Retries stay in the same format with a
// one-line correction note appended to the input section.
//
// NOTE on ELO: the Alpaca format has no persona slot, so the app's ELO
// setting is not expressible here and is intentionally omitted (same
// precedent as qwen35's attempt-1 PGN completion).
//
// The model is trained to predict "the subsequent moves until the end of
// the game", so the first SAN token of the reply is the move for the
// current position — parseFirstSan's first-mentioned-first order matches,
// and later tokens serve as engine-validated backup candidates.

const ALPACA_PREAMBLE =
  'Below is an instruction that describes a task, paired with an input ' +
  'that provides further context. Write a response that appropriately ' +
  'completes the request.\n\n' +
  '### Instruction:\n' +
  'Given the moves so far in a chess game, predict the subsequent moves ' +
  'until the end of the game.\n\n' +
  '### Input:\n'

const BAD_REPLY_MAX = 80

const truncate = (s: string): string =>
  s.length > BAD_REPLY_MAX ? `${s.slice(0, BAD_REPLY_MAX)}…` : s

function buildPrompt(ctx: MoveContext): string {
  const correction = ctx.correction
    ? `\nNote: "${truncate(ctx.correction.badReply)}" was not a legal ` +
      `move. Choose one move from the legal moves list.`
    : ''
  return (
    ALPACA_PREAMBLE +
    `Moves so far: ${toSanMoveChain(ctx.state)}\n` +
    `Legal moves: ${toLegalSan(ctx.legal)}${correction}\n\n` +
    '### Response:\n'
  )
}

export const chessLmAdapter: ModelAdapter = {
  name: 'chesslm-alpaca',
  matches: (modelId: string) => modelId.toLowerCase().includes('chesslm'),
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'completion',
    prompt: buildPrompt(ctx),
  }),
  parseMoves: (reply: string) => parseFirstSan(reply),
  // The model card generates with max_new_tokens=16; 32 leaves headroom
  // for the game continuation the parser mines for backup candidates.
  // Not a reasoning model — no reasoningEffort needed.
  sampling: { temperature: 0, maxTokens: 32 },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/llm/adapters/chessLm.test.ts`
Expected: PASS (all 11).

If the verbatim-prompt test fails on whitespace, fix the implementation to match the test (the test encodes the spec), not the other way around.

- [ ] **Step 5: Format, lint, commit**

```bash
npm run format
npm run lint
git add src/llm/adapters/chessLm.ts src/llm/adapters/chessLm.test.ts
git commit -m "feat: chessLM (llama-3.1-8b) Alpaca completion adapter"
```

---

### Task 3: Register the adapter

**Files:**

- Modify: `src/llm/adapters/index.ts`
- Modify: `src/llm/adapters/index.test.ts`

**Interfaces:**

- Consumes: `chessLmAdapter` from `./chessLm` (Task 2).
- Produces: `resolveAdapter('chesslm-0.01-llama-3.1-8b')` returns `chessLmAdapter`. Nothing else changes for consumers.

- [ ] **Step 1: Write the failing test**

Add to `src/llm/adapters/index.test.ts`:

```typescript
import { chessLmAdapter } from './chessLm'

test('resolveAdapter routes chessLM model ids to the chessLm adapter', () => {
  const adapter = resolveAdapter('chesslm-0.01-llama-3.1-8b')
  expect(adapter).toBe(chessLmAdapter)
  expect(adapter.name).toBe('chesslm-alpaca')
})
```

(The `import` line joins the existing import block at the top; the `test` block goes after the qwen3.5 routing test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/adapters/index.test.ts`
Expected: FAIL — the new test resolves the generic adapter, `expect(adapter).toBe(chessLmAdapter)` fails.

- [ ] **Step 3: Register in `src/llm/adapters/index.ts`**

```typescript
import { chessLmAdapter } from './chessLm'
```

and extend the list:

```typescript
const ADAPTERS: ModelAdapter[] = [gemma4Adapter, qwen35Adapter, chessLmAdapter]
```

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: PASS — including the untouched `resolveAdapter` fallback tests (the chessLM matcher must not swallow generic ids).

- [ ] **Step 5: Full quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/llm/adapters/index.ts src/llm/adapters/index.test.ts
git commit -m "feat: register the chessLM adapter in resolveAdapter"
```

---

### Task 4: Documentation

**Files:**

- Modify: `CLAUDE.md` (the "Move selection now has two real per-model adapters" paragraph in Project structure — update the count and add chessLM; e.g. "three real per-model adapters … and `chessLm` (Alpaca completion prompt from the model card's documented finetune format, `ippity/chessLM-0.01-llama-3.1-8b`; no campaign — format fixed by training)").

**Interfaces:** none — docs only.

- [ ] **Step 1: Update the paragraph, run `npm run format` (CI prettier-checks Markdown)**

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note the chessLM adapter in CLAUDE.md"
```
