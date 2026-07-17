# LLM Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a local LM Studio model play Black against the human (White), via a universal per-model adapter layer that encodes the position and parses the reply, with the engine judging legality.

**Architecture:** New code lives in `src/llm` (transports, a `ModelAdapter` strategy layer, and a `selectMove` engine that validates against `src/engine`) plus orchestration in `src/ui/game/useGame`. `selectMove` depends only on the `ModelAdapter` interface; `resolveAdapter(modelId)` injects a concrete adapter (generic default in C). `useGame` owns the async lifecycle: thinking state, connection auto-retry + banner, cancellation.

**Tech Stack:** TypeScript 5 (strict), React 18, Vite 6, Vitest + @testing-library/react (jsdom), chess.js (via `src/engine`).

## Global Constraints

- **No backend.** Static frontend only. All model calls go to LM Studio over HTTP at `http://localhost:<port>`.
- **Rules owned by the library.** Move legality is decided by `src/engine` (chess.js) — never by the LLM. The LLM only proposes; the engine judges.
- **Layering is one-directional:** `engine` (no deps) ← `llm` (may import `engine`) ← `ui` (imports both). `llm` must **not** import from `ui`.
- **TypeScript strict is on.** No `any` without a justifying comment.
- **Prettier:** no semicolons, single quotes, trailing commas, 80-column width. Run `npm run format` before committing.
- **ESLint must pass** (`eslint .`), including react-hooks rules.
- **Tests live next to source** (`*.test.ts` / `*.test.tsx`), run under Vitest with `globals: true` + jsdom. Test behavior, not implementation.
- **No real network in unit tests** — mock `fetch`, or inject the transport/`selectMove` function.
- **Commit messages:** conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`), imperative mood. End with the `Co-Authored-By` trailer used in this repo.
- **Local quality gate mirrors CI:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

## File Structure

- Create `src/llm/chat.ts` — `chatCompletion` + `completion` transports; owns `ChatMessage` type.
- Create `src/llm/chat.test.ts` — transport tests (mock `fetch`).
- Create `src/llm/adapters/types.ts` — `ModelAdapter`, `ModelRequest`, `MoveContext` (re-exports `ChatMessage`).
- Create `src/llm/adapters/encoding.ts` — pure position encoders.
- Create `src/llm/adapters/encoding.test.ts`.
- Create `src/llm/adapters/genericFen.ts` — the default adapter (FEN-only, chat).
- Create `src/llm/adapters/genericFen.test.ts`.
- Create `src/llm/adapters/index.ts` — `ADAPTERS` registry + `defaultAdapter` + `resolveAdapter`.
- Create `src/llm/adapters/index.test.ts`.
- Create `src/llm/selectMove.ts` — generic move-selection engine.
- Create `src/llm/selectMove.test.ts`.
- Modify `src/ui/game/useGame.ts` — new signature + async model-turn orchestration.
- Modify `src/ui/game/useGame.test.ts` — rewrite for "human plays White, model plays Black".
- Modify `src/ui/app/i18n.tsx` — add `conn_lost`, `retry_move`, `fallback_move` (RU + EN).
- Modify `src/ui/game/GameScreen.tsx` — pass `baseUrl`/`model` to `useGame`; render thinking text, banner, fallback note.
- Modify `src/ui/game/GameScreen.test.tsx` — rewrite for injected scripted opponent.
- Modify `src/styles/app.css` — minimal `.conn-error` / `.fallback-note` styles.
- Modify `src/App.tsx` — pass `baseUrl` + `model` to `GameScreen`.

---

## Task 1: Chat + completion transports (`src/llm/chat.ts`)

**Files:**
- Create: `src/llm/chat.ts`
- Test: `src/llm/chat.test.ts`

**Interfaces:**
- Consumes: `normalizeBaseUrl` from `src/llm/url.ts`; `LMStudioError` from `src/llm/types.ts`.
- Produces:
  - `type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }`
  - `chatCompletion(baseUrl: string, req: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<string>`
  - `completion(baseUrl: string, req: { model: string; prompt: string; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `src/llm/chat.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { chatCompletion, completion } from './chat'
import { LMStudioError } from './types'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const { ok = true, status = 200 } = init
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as Response)
}

const chatBody = { choices: [{ message: { content: 'Nf3' } }] }
const completionBody = { choices: [{ text: ' e5 Nf6' }] }

test('chatCompletion posts to /api/v0/chat/completions and returns content', async () => {
  const spy = mockFetchOnce(chatBody)
  const out = await chatCompletion('localhost:1234/', {
    model: 'm',
    messages: [{ role: 'user', content: 'hi' }],
    temperature: 0.7,
    maxTokens: 64,
  })
  expect(out).toBe('Nf3')
  const [url, init] = spy.mock.calls[0]
  expect(url).toBe('http://localhost:1234/api/v0/chat/completions')
  expect(init?.method).toBe('POST')
  const sent = JSON.parse(init?.body as string)
  expect(sent).toMatchObject({ model: 'm', max_tokens: 64, temperature: 0.7 })
  expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }])
})

test('completion posts to /api/v0/completions and returns text', async () => {
  const spy = mockFetchOnce(completionBody)
  const out = await completion('http://localhost:1234', {
    model: 'm',
    prompt: 'Moves so far: e4',
    maxTokens: 16,
  })
  expect(out).toBe(' e5 Nf6')
  expect(spy.mock.calls[0][0]).toBe('http://localhost:1234/api/v0/completions')
})

test('chatCompletion throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(
    chatCompletion('http://localhost:1234', { model: 'm', messages: [] }),
  ).rejects.toMatchObject({ kind: 'network' })
})

test('chatCompletion throws http error on non-ok response', async () => {
  mockFetchOnce({}, { ok: false, status: 500 })
  const err = await chatCompletion('http://localhost:1234', {
    model: 'm',
    messages: [],
  }).catch((e) => e)
  expect(err).toBeInstanceOf(LMStudioError)
  expect(err).toMatchObject({ kind: 'http' })
})

test('chatCompletion throws parse error when content is missing', async () => {
  mockFetchOnce({ choices: [{}] })
  await expect(
    chatCompletion('http://localhost:1234', { model: 'm', messages: [] }),
  ).rejects.toMatchObject({ kind: 'parse' })
})

test('completion throws parse error when text is missing', async () => {
  mockFetchOnce({ choices: [{}] })
  await expect(
    completion('http://localhost:1234', { model: 'm', prompt: 'x' }),
  ).rejects.toMatchObject({ kind: 'parse' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/chat.test.ts`
Expected: FAIL — cannot resolve `./chat`.

- [ ] **Step 3: Write minimal implementation**

Create `src/llm/chat.ts`:

```ts
import { normalizeBaseUrl } from './url'
import { LMStudioError } from './types'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatRequest = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export type CompletionRequest = {
  model: string
  prompt: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

async function postJson(
  url: string,
  base: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch {
    throw new LMStudioError(
      'network',
      `Can't reach LM Studio at ${base}. Check the URL and that CORS is enabled in LM Studio.`,
    )
  }
  if (!response.ok) {
    throw new LMStudioError(
      'http',
      `LM Studio returned HTTP ${response.status}.`,
    )
  }
  try {
    return await response.json()
  } catch {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
}

function sampling(req: {
  temperature?: number
  maxTokens?: number
}): Record<string, number> {
  return {
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
  }
}

export async function chatCompletion(
  baseUrl: string,
  req: ChatRequest,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl)
  const body = await postJson(
    `${base}/api/v0/chat/completions`,
    base,
    { model: req.model, messages: req.messages, ...sampling(req) },
    req.signal,
  )
  const content = (
    body as { choices?: { message?: { content?: unknown } }[] }
  )?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new LMStudioError('parse', 'LM Studio returned no message content.')
  }
  return content
}

export async function completion(
  baseUrl: string,
  req: CompletionRequest,
): Promise<string> {
  const base = normalizeBaseUrl(baseUrl)
  const body = await postJson(
    `${base}/api/v0/completions`,
    base,
    { model: req.model, prompt: req.prompt, ...sampling(req) },
    req.signal,
  )
  const text = (body as { choices?: { text?: unknown }[] })?.choices?.[0]?.text
  if (typeof text !== 'string') {
    throw new LMStudioError('parse', 'LM Studio returned no completion text.')
  }
  return text
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/llm/chat.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/chat.ts src/llm/chat.test.ts
git commit -m "feat: add LM Studio chat + completion transports

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Position encoders (`src/llm/adapters/encoding.ts`)

**Files:**
- Create: `src/llm/adapters/encoding.ts`
- Test: `src/llm/adapters/encoding.test.ts`

**Interfaces:**
- Consumes: `newGame`, `move` from `src/engine/game.ts`; `legalMoves` from `src/engine/game.ts`; `GameState`, `LegalMove` from `src/engine/types.ts`.
- Produces:
  - `toFen(state: GameState): string`
  - `toSanMoveChain(state: GameState): string`
  - `toPgn(state: GameState): string`
  - `toLegalSan(legal: LegalMove[]): string`

> **Note:** `toUciMoveChain` from the spec is intentionally **not** implemented in C. It would require driving chess.js directly inside `llm/` (SAN→UCI), and no C-shipped adapter needs it (YAGNI). When a UCI-consuming adapter arrives, it belongs behind an `engine` helper, not here. The remaining four encoders are pure operations over `GameState`/`LegalMove` with no chess.js import.

- [ ] **Step 1: Write the failing test**

Create `src/llm/adapters/encoding.test.ts`:

```ts
import { expect, test } from 'vitest'
import { newGame, move } from '../../engine/game'
import { legalMoves } from '../../engine/game'
import { toFen, toSanMoveChain, toPgn, toLegalSan } from './encoding'

function after(sans: string[]) {
  let s = newGame()
  for (const san of sans) {
    const next = move(s, san)
    if (!next) throw new Error(`illegal in fixture: ${san}`)
    s = next
  }
  return s
}

test('toFen returns the current FEN', () => {
  const s = after(['e4'])
  expect(toFen(s)).toBe(s.fen)
})

test('toSanMoveChain joins the SAN history with spaces', () => {
  const s = after(['e4', 'd5', 'exd5'])
  expect(toSanMoveChain(s)).toBe('e4 d5 exd5')
})

test('toSanMoveChain is empty at the start', () => {
  expect(toSanMoveChain(newGame())).toBe('')
})

test('toPgn numbers full moves', () => {
  const s = after(['e4', 'd5', 'exd5'])
  expect(toPgn(s)).toBe('1. e4 d5 2. exd5')
})

test('toLegalSan joins legal-move SANs', () => {
  const s = newGame()
  const out = toLegalSan(legalMoves(s))
  expect(out.split(' ')).toContain('e4')
  expect(out.split(' ')).toContain('Nf3')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/adapters/encoding.test.ts`
Expected: FAIL — cannot resolve `./encoding`.

- [ ] **Step 3: Write minimal implementation**

Create `src/llm/adapters/encoding.ts`:

```ts
import type { GameState, LegalMove } from '../../engine/types'

export function toFen(state: GameState): string {
  return state.fen
}

export function toSanMoveChain(state: GameState): string {
  return state.history.join(' ')
}

export function toPgn(state: GameState): string {
  const parts: string[] = []
  state.history.forEach((san, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`)
    parts.push(san)
  })
  return parts.join(' ')
}

export function toLegalSan(legal: LegalMove[]): string {
  return legal.map((m) => m.san).join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/llm/adapters/encoding.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/adapters/encoding.ts src/llm/adapters/encoding.test.ts
git commit -m "feat: add position encoders for model adapters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Adapter layer (`types.ts`, `genericFen.ts`, `index.ts`)

**Files:**
- Create: `src/llm/adapters/types.ts`
- Create: `src/llm/adapters/genericFen.ts`
- Create: `src/llm/adapters/index.ts`
- Test: `src/llm/adapters/genericFen.test.ts`
- Test: `src/llm/adapters/index.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` from `src/llm/chat.ts`; `GameState`, `LegalMove`, `MoveInput` from `src/engine/types.ts`; `toFen`, `toSanMoveChain` from `./encoding`.
- Produces:
  - `type ModelRequest = { kind: 'chat'; messages: ChatMessage[] } | { kind: 'completion'; prompt: string }`
  - `type MoveContext = { state: GameState; elo: number; legal: LegalMove[]; correction?: { badReply: string; reason: string } }`
  - `type ModelAdapter = { name: string; matches: (id: string) => boolean; buildRequest: (ctx: MoveContext) => ModelRequest; parseMoves: (reply: string, ctx: MoveContext) => MoveInput[]; sampling?: { temperature?: number; maxTokens?: number } }`
  - `parseSanCandidates(reply: string): string[]` (exported from `genericFen.ts` for testing)
  - `genericFenAdapter: ModelAdapter`
  - `resolveAdapter(modelId: string): ModelAdapter`, `defaultAdapter: ModelAdapter` (from `index.ts`)

- [ ] **Step 1: Write the failing tests**

Create `src/llm/adapters/genericFen.test.ts`:

```ts
import { expect, test } from 'vitest'
import { newGame, legalMoves } from '../../engine/game'
import { genericFenAdapter, parseSanCandidates } from './genericFen'
import type { MoveContext } from './types'

function ctx(overrides: Partial<MoveContext> = {}): MoveContext {
  const state = newGame()
  return { state, elo: 1200, legal: legalMoves(state), ...overrides }
}

test('buildRequest emits a chat request with FEN and the ELO persona', () => {
  const req = genericFenAdapter.buildRequest(ctx())
  expect(req.kind).toBe('chat')
  if (req.kind !== 'chat') return
  expect(req.messages[0].role).toBe('system')
  expect(req.messages[0].content).toContain('1200')
  expect(req.messages[1].content).toContain(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  )
})

test('buildRequest appends the correction when retrying', () => {
  const req = genericFenAdapter.buildRequest(
    ctx({ correction: { badReply: 'Qzz9', reason: 'illegal' } }),
  )
  if (req.kind !== 'chat') throw new Error('expected chat')
  expect(req.messages[1].content).toContain('Qzz9')
})

test('parseSanCandidates returns a bare move', () => {
  expect(parseSanCandidates('Nf3')).toContain('Nf3')
})

test('parseSanCandidates extracts a move from prose', () => {
  expect(parseSanCandidates("I'll play Nf3.")).toContain('Nf3')
})

test('parseSanCandidates handles a leading line of reasoning', () => {
  expect(parseSanCandidates('Let me think...\ne5')).toContain('e5')
})

test('parseMoves feeds candidates the engine can validate', () => {
  const c = ctx()
  // after 1. e4, Black to move — build a black-to-move context
  const moves = genericFenAdapter.parseMoves('e5', c)
  expect(moves).toContain('e5')
})
```

Create `src/llm/adapters/index.test.ts`:

```ts
import { expect, test } from 'vitest'
import { resolveAdapter, defaultAdapter } from './index'
import { genericFenAdapter } from './genericFen'

test('resolveAdapter falls back to the generic default for unknown models', () => {
  expect(resolveAdapter('some/unknown-model')).toBe(genericFenAdapter)
  expect(defaultAdapter).toBe(genericFenAdapter)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/llm/adapters/genericFen.test.ts src/llm/adapters/index.test.ts`
Expected: FAIL — cannot resolve `./genericFen` / `./index`.

- [ ] **Step 3: Write minimal implementation**

Create `src/llm/adapters/types.ts`:

```ts
import type { ChatMessage } from '../chat'
import type { GameState, LegalMove, MoveInput } from '../../engine/types'

export type { ChatMessage }

// Transport is a property of the adapter: a chat request OR a raw prompt.
export type ModelRequest =
  | { kind: 'chat'; messages: ChatMessage[] }
  | { kind: 'completion'; prompt: string }

export type MoveContext = {
  state: GameState
  elo: number
  legal: LegalMove[]
  correction?: { badReply: string; reason: string }
}

export type ModelAdapter = {
  name: string
  matches: (modelId: string) => boolean
  buildRequest: (ctx: MoveContext) => ModelRequest
  parseMoves: (reply: string, ctx: MoveContext) => MoveInput[]
  sampling?: { temperature?: number; maxTokens?: number }
}
```

Create `src/llm/adapters/genericFen.ts`:

```ts
import type { MoveInput } from '../../engine/types'
import { toFen, toSanMoveChain } from './encoding'
import type { ModelAdapter, ModelRequest, MoveContext } from './types'

// The generic default: FEN-only, chat transport, no legal-move list (a
// deliberate product choice — an honest test of the model's own strength).
// ELO is expressed as a numeric persona only; the ui-owned band copy
// (ui/app/demoData) stays in the ui layer — llm must not import from ui.
const system = (elo: number): string =>
  `You are a chess engine playing the Black pieces at approximately ${elo} ` +
  `Elo strength. Reply with ONLY your move in Standard Algebraic Notation ` +
  `(SAN), for example: Nf3, e5, O-O, exd8=Q. No explanation, no commentary — ` +
  `just the single move.`

function userMessage(ctx: MoveContext): string {
  const moves = toSanMoveChain(ctx.state)
  const history = moves.length > 0 ? `Moves so far: ${moves}\n` : ''
  const correction = ctx.correction
    ? `\nYour previous reply "${ctx.correction.badReply}" was not a legal ` +
      `move in this position. Reply with a single legal move in SAN.`
    : ''
  return (
    `${history}Position (FEN): ${toFen(ctx.state)}\n` +
    `It is Black's turn. Your move:${correction}`
  )
}

const SAN_RE =
  /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/

// Extract ordered candidate move tokens from a possibly-chatty reply. The
// engine is the ultimate judge; this only needs to surface likely tokens.
export function parseSanCandidates(reply: string): string[] {
  const cleaned = reply.trim()
  const candidates: string[] = []
  const push = (raw: string | undefined) => {
    if (!raw) return
    const t = raw.trim().replace(/^["'`*]+/, '').replace(/["'`*.!,]+$/, '')
    if (t && !candidates.includes(t)) candidates.push(t)
  }
  push(cleaned)
  push(cleaned.split('\n')[0])
  push(cleaned.split(/\s+/)[0])
  const m = cleaned.match(SAN_RE)
  if (m) push(m[0])
  return candidates
}

export const genericFenAdapter: ModelAdapter = {
  name: 'generic-fen',
  matches: () => true,
  buildRequest: (ctx: MoveContext): ModelRequest => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: system(ctx.elo) },
      { role: 'user', content: userMessage(ctx) },
    ],
  }),
  parseMoves: (reply: string): MoveInput[] => parseSanCandidates(reply),
  sampling: { temperature: 0.7, maxTokens: 64 },
}
```

Create `src/llm/adapters/index.ts`:

```ts
import { genericFenAdapter } from './genericFen'
import type { ModelAdapter } from './types'

// Specialised adapters are registered here as they are written. The generic
// default is NOT in this list — it is only reached via the `?? defaultAdapter`
// fallback, so its `matches: () => true` never swallows a specific model.
const ADAPTERS: ModelAdapter[] = []

export const defaultAdapter: ModelAdapter = genericFenAdapter

export function resolveAdapter(modelId: string): ModelAdapter {
  return ADAPTERS.find((a) => a.matches(modelId)) ?? defaultAdapter
}

export type { ModelAdapter, ModelRequest, MoveContext, ChatMessage } from './types'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/llm/adapters/genericFen.test.ts src/llm/adapters/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/llm/adapters/types.ts src/llm/adapters/genericFen.ts src/llm/adapters/index.ts src/llm/adapters/genericFen.test.ts src/llm/adapters/index.test.ts
git commit -m "feat: add ModelAdapter abstraction + generic FEN default adapter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Move-selection engine (`src/llm/selectMove.ts`)

**Files:**
- Create: `src/llm/selectMove.ts`
- Test: `src/llm/selectMove.test.ts`

**Interfaces:**
- Consumes: `chatCompletion`, `completion` from `./chat`; `resolveAdapter` from `./adapters`; `ModelAdapter` from `./adapters/types`; `legalMoves`, `move` from `../engine/game`; `GameState` from `../engine/types`; `LMStudioError` from `./types`.
- Produces:
  - `MAX_MOVE_RETRIES` (= 3)
  - `type MoveSelection = { nextState: GameState; san: string; source: 'model' | 'fallback' }`
  - `type SelectMoveParams = { baseUrl: string; model: string; state: GameState; elo: number; signal?: AbortSignal }`
  - `type SelectMoveDeps = { adapter?: ModelAdapter; chat?: typeof chatCompletion; complete?: typeof completion; rng?: () => number }`
  - `selectMove(params: SelectMoveParams, deps?: SelectMoveDeps): Promise<MoveSelection>`

- [ ] **Step 1: Write the failing test**

Create `src/llm/selectMove.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
import { newGame, move } from '../engine/game'
import { selectMove } from './selectMove'
import { LMStudioError } from './types'
import type { ModelAdapter } from './adapters/types'

// A black-to-move position: 1. e4
const afterE4 = () => move(newGame(), 'e4')!

// Minimal fake adapter: emits a trivial chat request; parses the reply as one
// SAN candidate. The reply content is driven entirely by the fake transport.
const fakeAdapter: ModelAdapter = {
  name: 'fake',
  matches: () => true,
  buildRequest: () => ({ kind: 'chat', messages: [] }),
  parseMoves: (reply) => [reply.trim()],
}

const params = (state = afterE4()) => ({
  baseUrl: 'http://x',
  model: 'm',
  state,
  elo: 1200,
})

test('returns the model move when it is legal on the first try', async () => {
  const chat = vi.fn().mockResolvedValue('e5')
  const out = await selectMove(params(), { adapter: fakeAdapter, chat })
  expect(out.source).toBe('model')
  expect(out.san).toBe('e5')
  expect(out.nextState.history).toEqual(['e4', 'e5'])
  expect(chat).toHaveBeenCalledTimes(1)
})

test('retries with a correction after an illegal move, then succeeds', async () => {
  const chat = vi
    .fn()
    .mockResolvedValueOnce('Qzz9') // illegal
    .mockResolvedValueOnce('e5') // legal
  const correctionSpy = vi.fn()
  const adapter: ModelAdapter = {
    ...fakeAdapter,
    buildRequest: (ctx) => {
      correctionSpy(ctx.correction)
      return { kind: 'chat', messages: [] }
    },
  }
  const out = await selectMove(params(), { adapter, chat })
  expect(out.source).toBe('model')
  expect(out.san).toBe('e5')
  expect(chat).toHaveBeenCalledTimes(2)
  // second buildRequest received a correction referencing the bad reply
  expect(correctionSpy.mock.calls[1][0]).toMatchObject({ badReply: 'Qzz9' })
})

test('falls back to a random legal move after exhausting retries', async () => {
  const chat = vi.fn().mockResolvedValue('totally-not-a-move')
  const out = await selectMove(params(), {
    adapter: fakeAdapter,
    chat,
    rng: () => 0, // pick the first legal move deterministically
  })
  expect(out.source).toBe('fallback')
  expect(chat).toHaveBeenCalledTimes(3) // MAX_MOVE_RETRIES
  // the fallback move is genuinely legal (engine applied it)
  expect(out.nextState.history).toHaveLength(2)
})

test('propagates LMStudioError from the transport (no fallback)', async () => {
  const chat = vi
    .fn()
    .mockRejectedValue(new LMStudioError('network', 'down'))
  await expect(
    selectMove(params(), { adapter: fakeAdapter, chat }),
  ).rejects.toBeInstanceOf(LMStudioError)
})

test('dispatches to the completion transport for completion adapters', async () => {
  const complete = vi.fn().mockResolvedValue('e5')
  const adapter: ModelAdapter = {
    ...fakeAdapter,
    buildRequest: () => ({ kind: 'completion', prompt: 'p' }),
  }
  const out = await selectMove(params(), { adapter, complete })
  expect(out.san).toBe('e5')
  expect(complete).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/selectMove.test.ts`
Expected: FAIL — cannot resolve `./selectMove`.

- [ ] **Step 3: Write minimal implementation**

Create `src/llm/selectMove.ts`:

```ts
import { chatCompletion, completion } from './chat'
import { resolveAdapter } from './adapters'
import type { ModelAdapter } from './adapters/types'
import { legalMoves, move } from '../engine/game'
import type { GameState } from '../engine/types'

export const MAX_MOVE_RETRIES = 3
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 64

export type MoveSelection = {
  nextState: GameState
  san: string
  source: 'model' | 'fallback'
}

export type SelectMoveParams = {
  baseUrl: string
  model: string
  state: GameState
  elo: number
  signal?: AbortSignal
}

export type SelectMoveDeps = {
  adapter?: ModelAdapter
  chat?: typeof chatCompletion
  complete?: typeof completion
  rng?: () => number
}

export async function selectMove(
  params: SelectMoveParams,
  deps: SelectMoveDeps = {},
): Promise<MoveSelection> {
  const { baseUrl, model, state, elo, signal } = params
  const chat = deps.chat ?? chatCompletion
  const complete = deps.complete ?? completion
  const rng = deps.rng ?? Math.random
  const adapter = deps.adapter ?? resolveAdapter(model)
  const legal = legalMoves(state)

  let correction: { badReply: string; reason: string } | undefined
  for (let attempt = 0; attempt < MAX_MOVE_RETRIES; attempt++) {
    const ctx = { state, elo, legal, correction }
    const request = adapter.buildRequest(ctx)
    const temperature = adapter.sampling?.temperature ?? DEFAULT_TEMPERATURE
    const maxTokens = adapter.sampling?.maxTokens ?? DEFAULT_MAX_TOKENS

    // LMStudioError from the transport propagates — a connection failure is
    // the orchestrator's concern, not something we mask with a random move.
    const reply =
      request.kind === 'chat'
        ? await chat(baseUrl, {
            model,
            messages: request.messages,
            temperature,
            maxTokens,
            signal,
          })
        : await complete(baseUrl, {
            model,
            prompt: request.prompt,
            temperature,
            maxTokens,
            signal,
          })

    for (const candidate of adapter.parseMoves(reply, ctx)) {
      const next = move(state, candidate)
      if (next) {
        return { nextState: next, san: next.lastMove?.san ?? '', source: 'model' }
      }
    }
    correction = { badReply: reply, reason: 'illegal or unparseable move' }
  }

  // Fallback: a uniformly-random legal move so the game never stalls.
  const pick = legal[Math.floor(rng() * legal.length)]
  const next = move(state, {
    from: pick.from,
    to: pick.to,
    ...(pick.promotion ? { promotion: pick.promotion } : {}),
  })
  // `next` is guaranteed non-null: `pick` came from `legalMoves(state)`.
  return { nextState: next as GameState, san: pick.san, source: 'fallback' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/llm/selectMove.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/selectMove.ts src/llm/selectMove.test.ts
git commit -m "feat: add adapter-driven move-selection engine with retry + fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Orchestrate the model's turn in `useGame`

**Files:**
- Modify: `src/ui/game/useGame.ts`
- Modify (rewrite): `src/ui/game/useGame.test.ts`

**Interfaces:**
- Consumes: `selectMove` from `../../llm/selectMove`; `LMStudioError` from `../../llm/types`; `legalMoves`, `move`, `newGame` from `../../engine/game`.
- Produces:
  - `type UseGameOptions = { baseUrl: string; model: string; elo: number; selectMoveFn?: typeof selectMove; retryDelays?: number[] }`
  - `useGame(opts: UseGameOptions): UseGame`, where `UseGame` adds `thinking: boolean`, `connectionError: string | null`, `lastMoveFallback: boolean`, `retryModelTurn: () => void` to the existing shape (`state`, `selected`, `legalTargets`, `pendingPromotion`, `onSquareClick`, `choosePromotion`, `cancelPromotion`, `newGame`).

- [ ] **Step 1: Rewrite the test file (failing)**

Replace the entire contents of `src/ui/game/useGame.test.ts` with:

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import { move } from '../../engine/game'
import { LMStudioError } from '../../llm/types'
import { useGame, type UseGameOptions } from './useGame'
import type { selectMove } from '../../llm/selectMove'

// An opponent that never resolves — keeps the model "thinking" so tests that
// only exercise White-side selection stay on White's turn deterministically.
const idleOpponent: typeof selectMove = () => new Promise(() => {})

// A scripted opponent that plays the given Black SAN moves in order.
function scriptedOpponent(blackMoves: string[]): typeof selectMove {
  let i = 0
  return async ({ state }) => {
    const san = blackMoves[i++]
    const next = move(state, san)
    if (!next) throw new Error(`scripted illegal move: ${san}`)
    return { nextState: next, san: next.lastMove?.san ?? '', source: 'model' }
  }
}

// IMPORTANT: build the options object ONCE per test and pass the SAME
// reference into renderHook's callback. renderHook re-invokes that callback on
// every render, so an inline `opts()` would hand useGame a fresh `retryDelays`
// array / `selectMoveFn` each render, changing the effect's dependency
// identities and re-triggering the model turn. A stable object avoids that.
const opts = (over: Partial<UseGameOptions> = {}): UseGameOptions => ({
  baseUrl: 'http://x',
  model: 'm',
  elo: 1200,
  selectMoveFn: idleOpponent,
  retryDelays: [],
  ...over,
})

test('selecting a white pawn lists its legal targets', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  expect(result.current.selected).toBe('e2')
  expect(result.current.legalTargets.map((t) => t.to).sort()).toEqual([
    'e3',
    'e4',
  ])
})

test('clicking a black piece does not select it (white to move)', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e7'))
  expect(result.current.selected).toBeNull()
})

test('after White moves, the model plays Black and the turn returns to White', async () => {
  const o = opts({ selectMoveFn: scriptedOpponent(['e5']) })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.state.history).toEqual(['e4', 'e5']))
  expect(result.current.state.turn).toBe('w')
  expect(result.current.thinking).toBe(false)
})

test('the human cannot move while the model is thinking', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4')) // black turn -> idle opponent
  // attempting to select/move is ignored on Black's turn
  act(() => result.current.onSquareClick('d2'))
  expect(result.current.selected).toBeNull()
  expect(result.current.state.history).toEqual(['e4'])
})

test('a connection failure surfaces connectionError, then retry recovers', async () => {
  const reply = scriptedOpponent(['e5'])
  let first = true
  const failing: typeof selectMove = (p) => {
    if (first) {
      first = false
      return Promise.reject(new LMStudioError('network', 'down'))
    }
    return reply(p)
  }
  const o = opts({ selectMoveFn: failing })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.connectionError).toBe('down'))
  expect(result.current.thinking).toBe(false)
  act(() => result.current.retryModelTurn())
  await waitFor(() => expect(result.current.state.history).toEqual(['e4', 'e5']))
  expect(result.current.connectionError).toBeNull()
})

test('a fallback move sets lastMoveFallback, cleared on the next human move', async () => {
  const fallbackOpponent: typeof selectMove = async ({ state }) => {
    const next = move(state, 'e5')!
    return { nextState: next, san: 'e5', source: 'fallback' }
  }
  const o = opts({ selectMoveFn: fallbackOpponent })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.lastMoveFallback).toBe(true))
  act(() => result.current.onSquareClick('d2'))
  act(() => result.current.onSquareClick('d4'))
  expect(result.current.lastMoveFallback).toBe(false)
})

test('newGame resets state, selection and thinking', async () => {
  const o = opts({ selectMoveFn: scriptedOpponent(['e5']) })
  const { result } = renderHook(() => useGame(o))
  act(() => result.current.onSquareClick('e2'))
  act(() => result.current.onSquareClick('e4'))
  await waitFor(() => expect(result.current.state.history).toEqual(['e4', 'e5']))
  act(() => result.current.newGame())
  expect(result.current.state.history).toEqual([])
  expect(result.current.selected).toBeNull()
  expect(result.current.thinking).toBe(false)
})

test('choosePromotion is a no-op when nothing is pending', () => {
  const o = opts()
  const { result } = renderHook(() => useGame(o))
  expect(result.current.pendingPromotion).toBeNull()
  act(() => result.current.choosePromotion('q'))
  expect(result.current.state.history).toEqual([])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/game/useGame.test.ts`
Expected: FAIL — `useGame` still has the old (no-arg) signature / missing `thinking`, `connectionError`, etc.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/ui/game/useGame.ts` with:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { legalMoves, move, newGame as engineNewGame } from '../../engine/game'
import type { GameState, PromotionPiece, SquareName } from '../../engine/types'
import { selectMove as realSelectMove } from '../../llm/selectMove'
import { LMStudioError } from '../../llm/types'
import { nameToRC } from './chessDemo'

export type LegalTarget = { to: SquareName; capture: boolean }
export type PendingPromotion = { from: SquareName; to: SquareName } | null

export type UseGameOptions = {
  baseUrl: string
  model: string
  elo: number
  // test seams (defaults are the real dependency / production backoff)
  selectMoveFn?: typeof realSelectMove
  retryDelays?: number[]
}

export type UseGame = {
  state: GameState
  selected: SquareName | null
  legalTargets: LegalTarget[]
  pendingPromotion: PendingPromotion
  thinking: boolean
  connectionError: string | null
  lastMoveFallback: boolean
  onSquareClick: (sq: SquareName) => void
  choosePromotion: (p: PromotionPiece) => void
  cancelPromotion: () => void
  retryModelTurn: () => void
  newGame: () => void
}

const DEFAULT_RETRY_DELAYS = [400, 800]

export function useGame(opts: UseGameOptions): UseGame {
  const { baseUrl, model, elo } = opts
  const selectMoveFn = opts.selectMoveFn ?? realSelectMove
  const retryDelays = opts.retryDelays ?? DEFAULT_RETRY_DELAYS

  const [state, setState] = useState<GameState>(() => engineNewGame())
  const [selected, setSelected] = useState<SquareName | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion>(null)
  const [thinking, setThinking] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [lastMoveFallback, setLastMoveFallback] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  // Bumped on newGame / unmount so stale async results are ignored.
  const generation = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const humansTurn = state.turn === 'w'

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected) return []
    return legalMoves(state, selected).map((m) => ({
      to: m.to,
      capture: m.san.includes('x'),
    }))
  }, [state, selected])

  const onSquareClick = useCallback(
    (sq: SquareName) => {
      if (pendingPromotion) return
      if (thinking || connectionError) return
      if (!humansTurn) return
      if (state.status.isGameOver) return
      if (selected) {
        const toSq = legalMoves(state, selected).filter((m) => m.to === sq)
        if (toSq.length > 0) {
          if (toSq.some((m) => m.promotion)) {
            setPendingPromotion({ from: selected, to: sq })
            return
          }
          const next = move(state, { from: selected, to: sq })
          if (next) {
            setLastMoveFallback(false)
            setState(next)
            setSelected(null)
          }
          return
        }
      }
      const [r, c] = nameToRC(sq)
      const piece = state.board[r][c]
      setSelected(piece && piece.color === state.turn ? sq : null)
    },
    [state, selected, pendingPromotion, thinking, connectionError, humansTurn],
  )

  const choosePromotion = useCallback(
    (p: PromotionPiece) => {
      if (!pendingPromotion) return
      const next = move(state, {
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: p,
      })
      if (next) {
        setLastMoveFallback(false)
        setState(next)
      }
      setPendingPromotion(null)
      setSelected(null)
    },
    [state, pendingPromotion],
  )

  const cancelPromotion = useCallback(() => setPendingPromotion(null), [])

  const retryModelTurn = useCallback(() => {
    setConnectionError(null)
    setRetryNonce((n) => n + 1)
  }, [])

  const newGame = useCallback(() => {
    generation.current += 1
    abortRef.current?.abort()
    setState(engineNewGame())
    setSelected(null)
    setPendingPromotion(null)
    setThinking(false)
    setConnectionError(null)
    setLastMoveFallback(false)
  }, [])

  // Drive the model's (Black's) turn whenever it is Black to move.
  useEffect(() => {
    if (state.turn !== 'b') return
    if (state.status.isGameOver) return
    if (connectionError) return

    const myGen = generation.current
    const controller = new AbortController()
    abortRef.current = controller
    let cancelled = false
    const stale = () => cancelled || myGen !== generation.current
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))

    const run = async () => {
      setThinking(true)
      // one initial attempt + retryDelays.length auto-retries on LMStudioError
      for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
        try {
          const result = await selectMoveFn({
            baseUrl,
            model,
            state,
            elo,
            signal: controller.signal,
          })
          if (stale()) return
          setLastMoveFallback(result.source === 'fallback')
          setState(result.nextState)
          setThinking(false)
          return
        } catch (err) {
          if (stale()) return
          if (!(err instanceof LMStudioError)) throw err
          if (attempt < retryDelays.length) {
            await sleep(retryDelays[attempt])
            if (stale()) return
            continue
          }
          setConnectionError(err.message)
          setThinking(false)
          return
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    state,
    connectionError,
    retryNonce,
    baseUrl,
    model,
    elo,
    selectMoveFn,
    retryDelays,
  ])

  // Ignore any in-flight result after unmount.
  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  return {
    state,
    selected,
    legalTargets,
    pendingPromotion,
    thinking,
    connectionError,
    lastMoveFallback,
    onSquareClick,
    choosePromotion,
    cancelPromotion,
    retryModelTurn,
    newGame,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/game/useGame.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/game/useGame.ts src/ui/game/useGame.test.ts
git commit -m "feat: orchestrate the model's Black turn in useGame

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Game-screen presentation (thinking, banner, fallback note)

**Files:**
- Modify: `src/ui/app/i18n.tsx` (add 3 keys × RU/EN)
- Modify: `src/ui/game/GameScreen.tsx`
- Modify (rewrite): `src/ui/game/GameScreen.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `useGame` (Task 5); `useI18n` from `../app/i18n`.
- Produces: `GameScreen` props gain `baseUrl: string`, `model: string`, and an optional `selectMoveFn?: typeof selectMove` test seam. New i18n keys: `conn_lost`, `retry_move`, `fallback_move`.

- [ ] **Step 1: Add the i18n keys**

In `src/ui/app/i18n.tsx`, add to the `ru` block (near the other `game` keys, after `theirsub`):

```ts
    conn_lost: 'Модель недоступна',
    retry_move: 'Повторить ход',
    fallback_move: 'Модель не нашла ход — сыгран случайный',
```

And the matching `en` block (after its `theirsub`):

```ts
    conn_lost: 'Model unavailable',
    retry_move: 'Retry move',
    fallback_move: 'Model found no move — a random one was played',
```

- [ ] **Step 2: Rewrite the GameScreen test (failing)**

Replace the entire contents of `src/ui/game/GameScreen.test.tsx` with:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { ReactNode } from 'react'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import { move } from '../../engine/game'
import type { selectMove } from '../../llm/selectMove'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>

const idleOpponent: typeof selectMove = () => new Promise(() => {})
function scriptedOpponent(blackMoves: string[]): typeof selectMove {
  let i = 0
  return async ({ state }) => {
    const san = blackMoves[i++]
    const next = move(state, san)!
    return { nextState: next, san: next.lastMove?.san ?? '', source: 'model' }
  }
}

const baseProps = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
  baseUrl: 'http://x',
  model: 'm',
}
const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-sq="${sq}"]`) as HTMLElement)

test('shows players, frozen clocks and the white-to-move status', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход белых',
  )
})

test('White moves, the model replies, and the move list updates', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={scriptedOpponent(['e5'])} />),
  )
  click(container, 'e2')
  click(container, 'e4')
  expect(screen.getByText('e4')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('e5')).toBeInTheDocument())
  await waitFor(() =>
    expect(container.querySelector('.status .txt b')!.textContent).toBe(
      'Ход белых',
    ),
  )
})

test('shows the "model is thinking" subtext on Black’s turn', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  click(container, 'e2')
  click(container, 'e4')
  await waitFor(() =>
    expect(container.querySelector('.status .txt small')!.textContent).toBe(
      'Модель думает…',
    ),
  )
})

test('Fool’s Mate: White plays, model plays Black to mate', async () => {
  const { container } = render(
    wrap(
      <GameScreen
        {...baseProps}
        selectMoveFn={scriptedOpponent(['e5', 'Qh4#'])}
      />,
    ),
  )
  click(container, 'f2')
  click(container, 'f3')
  await waitFor(() => expect(screen.getByText('e5')).toBeInTheDocument())
  click(container, 'g2')
  click(container, 'g4')
  await waitFor(() =>
    expect(container.querySelector('.status .txt b')!.textContent).toBe(
      'Мат — победа чёрных',
    ),
  )
})

test('the hint panel is inert', () => {
  render(wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />))
  expect(screen.getByRole('button', { name: /Фигура/ })).toBeDisabled()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx`
Expected: FAIL — `GameScreen` does not accept `baseUrl`/`model`/`selectMoveFn`, no thinking subtext.

- [ ] **Step 4: Update GameScreen**

In `src/ui/game/GameScreen.tsx`:

Add the import near the other imports:

```tsx
import { selectMove } from '../../llm/selectMove'
```

Replace the component signature and `useGame` call. Change the props destructuring/type to:

```tsx
export function GameScreen({
  opponentName,
  elo,
  boardStyle,
  pieceStyle,
  baseUrl,
  model,
  selectMoveFn,
}: {
  opponentName: string
  elo: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
  baseUrl: string
  model: string
  selectMoveFn?: typeof selectMove
}) {
  const { t } = useI18n()
  const g = useGame({ baseUrl, model, elo, selectMoveFn })
  const { state } = g
```

Replace the status `<small>` line so "thinking" wins over the turn text:

```tsx
            <small>
              {state.status.isGameOver
                ? ''
                : g.thinking
                  ? t('theirsub')
                  : status.theirs
                    ? t('theirmove')
                    : t('yourmove')}
            </small>
```

Add the connection banner + fallback note immediately after the `<div className={'status' ...}>...</div>` block and before `<HintConsole ... />`:

```tsx
        {g.connectionError && (
          <div className="conn-error" role="alert">
            <span>{t('conn_lost')}</span>
            <button
              type="button"
              className="btn"
              onClick={g.retryModelTurn}
            >
              {t('retry_move')}
            </button>
          </div>
        )}
        {g.lastMoveFallback && !g.thinking && (
          <div className="fallback-note">{t('fallback_move')}</div>
        )}
```

- [ ] **Step 5: Add minimal CSS**

Append to `src/styles/app.css`:

```css
.conn-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--danger, #e5484d);
  border-radius: 10px;
  color: var(--danger, #e5484d);
  font-size: 14px;
}
.fallback-note {
  padding: 6px 12px;
  color: var(--muted, #9aa);
  font-size: 13px;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/ui/game/GameScreen.test.tsx src/ui/app/i18n.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/app/i18n.tsx src/ui/game/GameScreen.tsx src/ui/game/GameScreen.test.tsx src/styles/app.css
git commit -m "feat: game screen shows thinking, connection banner and fallback note

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Wire `App.tsx` + live end-to-end verification

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `conn.state.baseUrl`, `conn.state.activeModel` from `useConnection`; `GameScreen` (Task 6).
- Produces: no new exports.

- [ ] **Step 1: Pass baseUrl + model to GameScreen**

In `src/App.tsx`, update the `GameScreen` usage:

```tsx
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
```

- [ ] **Step 2: Run the full unit gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: all green (App smoke test still passes; onboarding renders first so GameScreen's model turn is not triggered in that test).

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [ ] **Step 3: Live verification against LM Studio**

LM Studio is running at `http://localhost:1234` (test model available, CORS enabled). Do NOT use Bash to start the dev server.

1. `preview_start` with `{ name: "dev" }` (from `.claude/launch.json`, port 5173).
2. In the browser pane: complete onboarding (Connect `http://localhost:1234` → load & use a model → pick ELO → Start game).
3. Play `e4` as White by clicking `e2` then `e4`. Observe the opponent strip becomes active and the status subtext shows "Модель думает…".
4. `read_console_messages` / `read_network_requests` — confirm a POST to `/api/v0/chat/completions` and that Black replies with a legal move applied to the board.
5. Play a few more moves; confirm the move list and turn status update correctly and the board stays non-interactive while thinking.
6. `computer { action: "screenshot" }` — capture a position after the model has moved, as proof.

If the model repeatedly returns illegal text, confirm the retry→random-fallback keeps the game moving (the fallback note appears). If LM Studio is stopped mid-game, confirm the banner appears and "Повторить ход" recovers after restarting it.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire live LM Studio model as the Black opponent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Definition of done

- `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` all green.
- A human plays a full game as White against a locally-served model as Black, end-to-end, verified live against LM Studio.
- Illegal/unparseable model replies recover via retry → random-legal fallback without stalling.
- A mid-game connection drop shows the banner and recovers via "Retry move".
- `HintConsole` remains inert; clocks remain frozen; History remains on demo data (sub-project D).
