# LM Studio Connection Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A launch-time dialog to connect to an LM Studio server, list chat-capable models with load status, LOAD a model into memory (JIT), and USE one as the app's active model.

**Architecture:** A pure `src/llm` HTTP client (mockable network boundary, no React) exposes `listModels`/`loadModel` over `fetch` against LM Studio's `/api/v0` API. A `src/ui` component tree driven by a `useConnection` reducer hook renders the dialog, the model list, and a post-selection view. `App.tsx` switches between the dialog and the connected view.

**Tech Stack:** React 18 + TypeScript (strict), Vitest + @testing-library/react, `fetch`. No new runtime dependencies.

## Global Constraints

- All model calls go to LM Studio over HTTP at a user-supplied base URL; **API is `/api/v0` throughout**.
- **No real network in automated tests** — mock `fetch` (for `src/llm`) or mock the `src/llm` module (for `src/ui`). Per CLAUDE.md.
- Keep the three module responsibilities separate: `llm` = HTTP I/O, `ui` = React presentation + state. They must not bleed into each other.
- TypeScript strict; no `any` without a justifying comment.
- Prettier: no semicolons, single quotes, trailing commas, 80-col. Run `npm run format` before committing.
- Default URL string is exactly `http://localhost:1234`.
- Only chat-capable models (`type` is `llm` or `vlm`) are shown; `embeddings` and others are filtered out.
- Only the URL is persisted (localStorage key `lmchess.baseUrl`); the model selection is not persisted.
- Local quality gate before finishing: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

### Task 1: URL normalization (`src/llm/url.ts`)

The smallest pure unit: turn user input into a clean base URL. No dependencies, fully testable in isolation.

**Files:**

- Create: `src/llm/url.ts`
- Test: `src/llm/url.test.ts`
- Remove: `src/llm/.gitkeep` (folder now has real content)

**Interfaces:**

- Consumes: nothing.
- Produces: `normalizeBaseUrl(input: string): string` — trims whitespace, prepends `http://` if no scheme is present, and strips any trailing slash(es). Throws `Error` on empty/whitespace-only input.

- [ ] **Step 1: Write the failing test `src/llm/url.test.ts`**

```ts
import { normalizeBaseUrl } from './url'

test('strips trailing slash', () => {
  expect(normalizeBaseUrl('http://localhost:1234/')).toBe(
    'http://localhost:1234',
  )
})

test('adds http scheme when missing', () => {
  expect(normalizeBaseUrl('localhost:1234')).toBe('http://localhost:1234')
})

test('trims surrounding whitespace', () => {
  expect(normalizeBaseUrl('  http://127.0.0.1:1234  ')).toBe(
    'http://127.0.0.1:1234',
  )
})

test('preserves an explicit https scheme', () => {
  expect(normalizeBaseUrl('https://example.com')).toBe('https://example.com')
})

test('throws on empty input', () => {
  expect(() => normalizeBaseUrl('   ')).toThrow()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/llm/url.test.ts`
Expected: FAIL — cannot resolve `./url` / `normalizeBaseUrl is not a function`.

- [ ] **Step 3: Implement `src/llm/url.ts`**

```ts
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new Error('Base URL must not be empty')
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
  return withScheme.replace(/\/+$/, '')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/llm/url.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Remove the placeholder and commit**

```bash
git rm src/llm/.gitkeep
git add src/llm/url.ts src/llm/url.test.ts
git commit -m "feat(llm): add base URL normalization"
```

---

### Task 2: LLM types (`src/llm/types.ts`)

Shared types for models and errors. No logic, so it has no test of its own; it is exercised by Tasks 3–4. Kept as its own task because it is the contract every later task imports.

**Files:**

- Create: `src/llm/types.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `LMModelType = 'llm' | 'vlm' | 'embeddings' | (string & {})`
  - `LMModelState = 'loaded' | 'not-loaded' | 'loading' | (string & {})`
  - `LMModel = { id: string; type: LMModelType; state: LMModelState; quantization?: string; maxContextLength?: number; capabilities?: string[] }`
  - `LMErrorKind = 'network' | 'http' | 'parse' | 'empty'`
  - `class LMStudioError extends Error { kind: LMErrorKind }`
  - `CHAT_MODEL_TYPES: readonly ['llm', 'vlm']` and `isChatModel(m: LMModel): boolean`

- [ ] **Step 1: Create `src/llm/types.ts`**

```ts
export type LMModelType = 'llm' | 'vlm' | 'embeddings' | (string & {})
export type LMModelState = 'loaded' | 'not-loaded' | 'loading' | (string & {})

export type LMModel = {
  id: string
  type: LMModelType
  state: LMModelState
  quantization?: string
  maxContextLength?: number
  capabilities?: string[]
}

export type LMErrorKind = 'network' | 'http' | 'parse' | 'empty'

export class LMStudioError extends Error {
  kind: LMErrorKind
  constructor(kind: LMErrorKind, message: string) {
    super(message)
    this.name = 'LMStudioError'
    this.kind = kind
  }
}

export const CHAT_MODEL_TYPES = ['llm', 'vlm'] as const

export function isChatModel(model: LMModel): boolean {
  return (CHAT_MODEL_TYPES as readonly string[]).includes(model.type)
}
```

- [ ] **Step 2: Typecheck to verify it compiles**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/llm/types.ts
git commit -m "feat(llm): add model and error types"
```

---

### Task 3: `listModels` client (`src/llm/client.ts`)

Fetch and parse the model list, filtering to chat models, with typed errors. Uses a mocked `fetch` — no real network.

**Files:**

- Create: `src/llm/client.ts`
- Test: `src/llm/client.listModels.test.ts`

**Interfaces:**

- Consumes: `normalizeBaseUrl` (Task 1); `LMModel`, `LMStudioError`, `isChatModel` (Task 2).
- Produces: `listModels(baseUrl: string): Promise<LMModel[]>` — GETs `<normalized>/api/v0/models`, maps each `data[]` entry to `LMModel` (mapping `max_context_length` → `maxContextLength`), filters to chat models via `isChatModel`. Throws `LMStudioError` with the matching `kind`: `network` when `fetch` rejects, `http` on non-ok status, `parse` on invalid JSON or missing `data` array, `empty` when zero chat models remain.

- [ ] **Step 1: Write the failing test `src/llm/client.listModels.test.ts`**

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { listModels } from './client'
import { LMStudioError } from './types'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchOnce(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const { ok = true, status = 200 } = init
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as Response)
}

const sample = {
  object: 'list',
  data: [
    {
      id: 'google/gemma-4-e4b',
      object: 'model',
      type: 'vlm',
      state: 'not-loaded',
      max_context_length: 131072,
    },
    {
      id: 'qwen/qwen3.5-9b',
      object: 'model',
      type: 'llm',
      state: 'loaded',
      max_context_length: 262144,
    },
    {
      id: 'text-embedding-nomic',
      object: 'model',
      type: 'embeddings',
      state: 'not-loaded',
      max_context_length: 2048,
    },
  ],
}

test('requests the /api/v0/models endpoint on the normalized base URL', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => sample,
  } as Response)
  await listModels('localhost:1234/')
  expect(spy).toHaveBeenCalledWith('http://localhost:1234/api/v0/models')
})

test('returns only chat models, mapping context length', async () => {
  mockFetchOnce(sample)
  const models = await listModels('http://localhost:1234')
  expect(models.map((m) => m.id)).toEqual([
    'google/gemma-4-e4b',
    'qwen/qwen3.5-9b',
  ])
  expect(models[0].maxContextLength).toBe(131072)
})

test('throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'network',
  })
})

test('throws http error on non-ok response', async () => {
  mockFetchOnce({}, { ok: false, status: 500 })
  await expect(listModels('http://localhost:1234')).rejects.toBeInstanceOf(
    LMStudioError,
  )
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'http',
  })
})

test('throws empty error when no chat models remain', async () => {
  mockFetchOnce({
    object: 'list',
    data: [
      { id: 'e', object: 'model', type: 'embeddings', state: 'not-loaded' },
    ],
  })
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'empty',
  })
})

test('throws parse error when data is not an array', async () => {
  mockFetchOnce({ object: 'list' })
  await expect(listModels('http://localhost:1234')).rejects.toMatchObject({
    kind: 'parse',
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/llm/client.listModels.test.ts`
Expected: FAIL — cannot resolve `./client` / `listModels is not a function`.

- [ ] **Step 3: Implement `listModels` in `src/llm/client.ts`**

```ts
import { normalizeBaseUrl } from './url'
import { isChatModel, LMModel, LMStudioError } from './types'

type RawModel = {
  id: string
  type: string
  state: string
  quantization?: string
  max_context_length?: number
  capabilities?: string[]
}

function mapModel(raw: RawModel): LMModel {
  return {
    id: raw.id,
    type: raw.type,
    state: raw.state,
    quantization: raw.quantization,
    maxContextLength: raw.max_context_length,
    capabilities: raw.capabilities,
  }
}

export async function listModels(baseUrl: string): Promise<LMModel[]> {
  const base = normalizeBaseUrl(baseUrl)
  let response: Response
  try {
    response = await fetch(`${base}/api/v0/models`)
  } catch {
    throw new LMStudioError(
      'network',
      `Can't reach LM Studio at ${base}. Check the URL and that CORS is enabled in LM Studio.`,
    )
  }
  if (!response.ok) {
    throw new LMStudioError(
      'http',
      `LM Studio returned HTTP ${response.status} for the model list.`,
    )
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
  const data = (body as { data?: unknown })?.data
  if (!Array.isArray(data)) {
    throw new LMStudioError('parse', 'LM Studio returned an invalid response.')
  }
  const chatModels = (data as RawModel[]).map(mapModel).filter(isChatModel)
  if (chatModels.length === 0) {
    throw new LMStudioError(
      'empty',
      'No chat-capable models are available on this server.',
    )
  }
  return chatModels
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/llm/client.listModels.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/llm/client.ts src/llm/client.listModels.test.ts
git commit -m "feat(llm): add listModels with chat filtering and typed errors"
```

---

### Task 4: `loadModel` client (JIT) (`src/llm/client.ts`)

Add JIT loading to the same client file. A minimal chat completion naming the model forces LM Studio to load it into memory.

**Files:**

- Modify: `src/llm/client.ts` (add `loadModel`)
- Test: `src/llm/client.loadModel.test.ts`

**Interfaces:**

- Consumes: `normalizeBaseUrl` (Task 1); `LMStudioError` (Task 2).
- Produces: `loadModel(baseUrl: string, id: string): Promise<void>` — POSTs to `<normalized>/api/v0/chat/completions` with JSON body `{ model: id, messages: [{ role: 'user', content: ' ' }], max_tokens: 1 }` and header `Content-Type: application/json`. Resolves on ok response; throws `LMStudioError` `network` when `fetch` rejects, `http` on non-ok status.

- [ ] **Step 1: Write the failing test `src/llm/client.loadModel.test.ts`**

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { loadModel } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

test('POSTs a minimal completion to trigger JIT load', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as Response)
  await loadModel('http://localhost:1234', 'google/gemma-4-e4b')
  expect(spy).toHaveBeenCalledTimes(1)
  const [url, init] = spy.mock.calls[0]
  expect(url).toBe('http://localhost:1234/api/v0/chat/completions')
  expect(init?.method).toBe('POST')
  expect(JSON.parse(init?.body as string)).toEqual({
    model: 'google/gemma-4-e4b',
    messages: [{ role: 'user', content: ' ' }],
    max_tokens: 1,
  })
})

test('throws http error when load response is not ok', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: false,
    status: 400,
    json: async () => ({}),
  } as Response)
  await expect(loadModel('http://localhost:1234', 'x')).rejects.toMatchObject({
    kind: 'http',
  })
})

test('throws network error when fetch rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
    new TypeError('failed to fetch'),
  )
  await expect(loadModel('http://localhost:1234', 'x')).rejects.toMatchObject({
    kind: 'network',
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/llm/client.loadModel.test.ts`
Expected: FAIL — `loadModel is not a function`.

- [ ] **Step 3: Add `loadModel` to `src/llm/client.ts`**

Append to the existing file (keep `listModels` as-is):

```ts
export async function loadModel(baseUrl: string, id: string): Promise<void> {
  const base = normalizeBaseUrl(baseUrl)
  let response: Response
  try {
    response = await fetch(`${base}/api/v0/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: id,
        messages: [{ role: 'user', content: ' ' }],
        max_tokens: 1,
      }),
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
      `LM Studio failed to load "${id}" (HTTP ${response.status}).`,
    )
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/llm/client.loadModel.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/llm/client.ts src/llm/client.loadModel.test.ts
git commit -m "feat(llm): add JIT loadModel"
```

---

### Task 5: `useConnection` hook (`src/ui/useConnection.ts`)

The reducer hook that orchestrates the flow and persists the URL. Depends on the `src/llm` client, which is mocked in tests.

**Files:**

- Create: `src/ui/useConnection.ts`
- Test: `src/ui/useConnection.test.ts`

**Interfaces:**

- Consumes: `listModels`, `loadModel` from `../llm/client`; `LMModel`, `LMStudioError` from `../llm/types`.
- Produces: `useConnection(): { state: ConnectionState; connect(url: string): Promise<void>; load(id: string): Promise<void>; use(id: string): void; reset(): void }` where

  ```ts
  type Phase = 'idle' | 'connecting' | 'connected' | 'ready' | 'error'
  type ConnectionState = {
    baseUrl: string
    phase: Phase
    models: LMModel[]
    loadingModelId: string | null
    activeModel: string | null
    error: string | null
  }
  ```

  Initial `baseUrl` = `localStorage.getItem('lmchess.baseUrl')` or `'http://localhost:1234'`; initial `phase` = `'idle'`. `connect` sets `connecting`, calls `listModels`, on success stores models + writes `localStorage['lmchess.baseUrl']` + phase `connected`, on `LMStudioError` sets phase `error` + `error` message. `load` sets `loadingModelId`, calls `loadModel` then `listModels` to refresh, clears `loadingModelId`; on error sets `error` but keeps phase `connected`. `use` sets `activeModel` + phase `ready`. `reset` clears `activeModel`, sets phase `connected`, keeps `models`.

- [ ] **Step 1: Write the failing test `src/ui/useConnection.test.ts`**

```ts
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useConnection } from './useConnection'
import { LMStudioError, type LMModel } from '../llm/types'
import * as client from '../llm/client'

const models: LMModel[] = [
  { id: 'a', type: 'llm', state: 'not-loaded' },
  { id: 'b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

test('defaults baseUrl to localhost when nothing stored', () => {
  const { result } = renderHook(() => useConnection())
  expect(result.current.state.baseUrl).toBe('http://localhost:1234')
  expect(result.current.state.phase).toBe('idle')
})

test('connect loads models and persists the url', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  expect(result.current.state.phase).toBe('connected')
  expect(result.current.state.models).toEqual(models)
  expect(localStorage.getItem('lmchess.baseUrl')).toBe('localhost:1234')
})

test('connect surfaces a typed error and stays on the dialog', async () => {
  vi.spyOn(client, 'listModels').mockRejectedValue(
    new LMStudioError('network', 'boom'),
  )
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  expect(result.current.state.phase).toBe('error')
  expect(result.current.state.error).toBe('boom')
})

test('load refreshes model state to loaded', async () => {
  vi.spyOn(client, 'listModels')
    .mockResolvedValueOnce(models)
    .mockResolvedValueOnce([
      { id: 'a', type: 'llm', state: 'loaded' },
      { id: 'b', type: 'vlm', state: 'loaded' },
    ])
  vi.spyOn(client, 'loadModel').mockResolvedValue()
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  await act(async () => {
    await result.current.load('a')
  })
  expect(client.loadModel).toHaveBeenCalledWith('localhost:1234', 'a')
  await waitFor(() =>
    expect(result.current.state.models[0].state).toBe('loaded'),
  )
  expect(result.current.state.loadingModelId).toBeNull()
})

test('use marks a model active and reset returns to the list', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result } = renderHook(() => useConnection())
  await act(async () => {
    await result.current.connect('localhost:1234')
  })
  act(() => {
    result.current.use('b')
  })
  expect(result.current.state.phase).toBe('ready')
  expect(result.current.state.activeModel).toBe('b')
  act(() => {
    result.current.reset()
  })
  expect(result.current.state.phase).toBe('connected')
  expect(result.current.state.activeModel).toBeNull()
  expect(result.current.state.models).toEqual(models)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/useConnection.test.ts`
Expected: FAIL — cannot resolve `./useConnection`.

- [ ] **Step 3: Implement `src/ui/useConnection.ts`**

```ts
import { useCallback, useReducer } from 'react'
import { listModels, loadModel } from '../llm/client'
import { LMModel, LMStudioError } from '../llm/types'

const STORAGE_KEY = 'lmchess.baseUrl'
const DEFAULT_URL = 'http://localhost:1234'

type Phase = 'idle' | 'connecting' | 'connected' | 'ready' | 'error'

export type ConnectionState = {
  baseUrl: string
  phase: Phase
  models: LMModel[]
  loadingModelId: string | null
  activeModel: string | null
  error: string | null
}

type Action =
  | { type: 'connect/start'; baseUrl: string }
  | { type: 'connect/ok'; models: LMModel[] }
  | { type: 'connect/fail'; error: string }
  | { type: 'load/start'; id: string }
  | { type: 'load/ok'; models: LMModel[] }
  | { type: 'load/fail'; error: string }
  | { type: 'use'; id: string }
  | { type: 'reset' }

function reducer(state: ConnectionState, action: Action): ConnectionState {
  switch (action.type) {
    case 'connect/start':
      return {
        ...state,
        baseUrl: action.baseUrl,
        phase: 'connecting',
        error: null,
      }
    case 'connect/ok':
      return {
        ...state,
        phase: 'connected',
        models: action.models,
        error: null,
      }
    case 'connect/fail':
      return { ...state, phase: 'error', error: action.error }
    case 'load/start':
      return { ...state, loadingModelId: action.id, error: null }
    case 'load/ok':
      return { ...state, loadingModelId: null, models: action.models }
    case 'load/fail':
      return { ...state, loadingModelId: null, error: action.error }
    case 'use':
      return { ...state, phase: 'ready', activeModel: action.id }
    case 'reset':
      return { ...state, phase: 'connected', activeModel: null }
  }
}

function initialState(): ConnectionState {
  return {
    baseUrl: localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL,
    phase: 'idle',
    models: [],
    loadingModelId: null,
    activeModel: null,
    error: null,
  }
}

function messageOf(error: unknown): string {
  return error instanceof LMStudioError || error instanceof Error
    ? error.message
    : 'Unexpected error'
}

export function useConnection() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const connect = useCallback(async (url: string) => {
    dispatch({ type: 'connect/start', baseUrl: url })
    try {
      const models = await listModels(url)
      localStorage.setItem(STORAGE_KEY, url)
      dispatch({ type: 'connect/ok', models })
    } catch (error) {
      dispatch({ type: 'connect/fail', error: messageOf(error) })
    }
  }, [])

  const load = useCallback(
    async (id: string) => {
      dispatch({ type: 'load/start', id })
      try {
        await loadModel(state.baseUrl, id)
        const models = await listModels(state.baseUrl)
        dispatch({ type: 'load/ok', models })
      } catch (error) {
        dispatch({ type: 'load/fail', error: messageOf(error) })
      }
    },
    [state.baseUrl],
  )

  const use = useCallback((id: string) => dispatch({ type: 'use', id }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, connect, load, use, reset }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/useConnection.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/ui/useConnection.ts src/ui/useConnection.test.ts
git commit -m "feat(ui): add useConnection reducer hook"
```

---

### Task 6: `ModelRow` component (`src/ui/ModelRow.tsx`)

One model row: id, type, status badge, and the LOAD/USE buttons with the correct enabled/disabled logic.

**Files:**

- Create: `src/ui/ModelRow.tsx`
- Test: `src/ui/ModelRow.test.tsx`

**Interfaces:**

- Consumes: `LMModel` from `../llm/types`.
- Produces: `ModelRow(props: { model: LMModel; isLoading: boolean; onLoad(id: string): void; onUse(id: string): void }): JSX.Element`. Renders the model id, its type, and a status badge with text `Loaded` or `Not loaded`. Shows a **Load** button when `state !== 'loaded'` (disabled while `isLoading`, label becomes `Loading…`), and a **Use** button that is `disabled` unless `state === 'loaded'`.

- [ ] **Step 1: Write the failing test `src/ui/ModelRow.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ModelRow } from './ModelRow'
import type { LMModel } from '../llm/types'

const notLoaded: LMModel = { id: 'a', type: 'llm', state: 'not-loaded' }
const loaded: LMModel = { id: 'b', type: 'vlm', state: 'loaded' }

test('not-loaded model: Load enabled, Use disabled', () => {
  render(
    <ModelRow
      model={notLoaded}
      isLoading={false}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Not loaded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled()
})

test('loaded model: Use enabled, no Load button', () => {
  render(
    <ModelRow
      model={loaded}
      isLoading={false}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Loaded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Use' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Load' })).toBeNull()
})

test('Load button shows Loading… and is disabled while loading', () => {
  render(
    <ModelRow model={notLoaded} isLoading onLoad={() => {}} onUse={() => {}} />,
  )
  expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
})

test('clicking Load and Use calls the handlers with the id', async () => {
  const onLoad = vi.fn()
  const onUse = vi.fn()
  const { rerender } = render(
    <ModelRow
      model={notLoaded}
      isLoading={false}
      onLoad={onLoad}
      onUse={onUse}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Load' }))
  expect(onLoad).toHaveBeenCalledWith('a')
  rerender(
    <ModelRow model={loaded} isLoading={false} onLoad={onLoad} onUse={onUse} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Use' }))
  expect(onUse).toHaveBeenCalledWith('b')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/ModelRow.test.tsx`
Expected: FAIL — cannot resolve `./ModelRow`.

- [ ] **Step 3: Implement `src/ui/ModelRow.tsx`**

```tsx
import type { LMModel } from '../llm/types'

type ModelRowProps = {
  model: LMModel
  isLoading: boolean
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ModelRow({ model, isLoading, onLoad, onUse }: ModelRowProps) {
  const loaded = model.state === 'loaded'
  return (
    <li>
      <span>{model.id}</span>
      <span>{model.type}</span>
      <span>{loaded ? 'Loaded' : 'Not loaded'}</span>
      {!loaded && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onLoad(model.id)}
        >
          {isLoading ? 'Loading…' : 'Load'}
        </button>
      )}
      <button type="button" disabled={!loaded} onClick={() => onUse(model.id)}>
        Use
      </button>
    </li>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/ModelRow.test.tsx`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ModelRow.tsx src/ui/ModelRow.test.tsx
git commit -m "feat(ui): add ModelRow component"
```

---

### Task 7: `ConnectionDialog` + `ModelList` (`src/ui/ConnectionDialog.tsx`, `src/ui/ModelList.tsx`)

The dialog: URL field + Connect, error display, and (once connected) the model list. `ModelList` is a thin list wrapper around `ModelRow`.

**Files:**

- Create: `src/ui/ModelList.tsx`
- Create: `src/ui/ConnectionDialog.tsx`
- Test: `src/ui/ConnectionDialog.test.tsx`

**Interfaces:**

- Consumes: `ModelRow` (Task 6); the `useConnection` return shape (Task 5) passed in as props (so the dialog stays presentational and testable without mocking the hook).
- Produces:
  - `ModelList(props: { models: LMModel[]; loadingModelId: string | null; onLoad(id: string): void; onUse(id: string): void }): JSX.Element` — a `<ul>` of `ModelRow`, passing `isLoading={loadingModelId === model.id}`.
  - `ConnectionDialog(props: { state: ConnectionState; onConnect(url: string): void; onLoad(id: string): void; onUse(id: string): void }): JSX.Element` — a text input pre-filled with `state.baseUrl` (accessible name `Server URL`), a `Connect` button that calls `onConnect` with the current field value, an error message when `state.error` is set, and `ModelList` when `state.models.length > 0`.

- [ ] **Step 1: Write the failing test `src/ui/ConnectionDialog.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConnectionDialog } from './ConnectionDialog'
import type { ConnectionState } from './useConnection'

const base: ConnectionState = {
  baseUrl: 'http://localhost:1234',
  phase: 'idle',
  models: [],
  loadingModelId: null,
  activeModel: null,
  error: null,
}

test('renders the URL field pre-filled with the base url', () => {
  render(
    <ConnectionDialog
      state={base}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByLabelText('Server URL')).toHaveValue(
    'http://localhost:1234',
  )
})

test('Connect calls onConnect with the edited url', async () => {
  const onConnect = vi.fn()
  render(
    <ConnectionDialog
      state={base}
      onConnect={onConnect}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  const field = screen.getByLabelText('Server URL')
  await userEvent.clear(field)
  await userEvent.type(field, 'http://127.0.0.1:1234')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(onConnect).toHaveBeenCalledWith('http://127.0.0.1:1234')
})

test('shows an error message when state.error is set', () => {
  render(
    <ConnectionDialog
      state={{ ...base, phase: 'error', error: 'Cannot reach server' }}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Cannot reach server')).toBeInTheDocument()
})

test('renders the model list once connected', () => {
  render(
    <ConnectionDialog
      state={{
        ...base,
        phase: 'connected',
        models: [{ id: 'a', type: 'llm', state: 'not-loaded' }],
      }}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('a')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/ConnectionDialog.test.tsx`
Expected: FAIL — cannot resolve `./ConnectionDialog`.

- [ ] **Step 3: Implement `src/ui/ModelList.tsx`**

```tsx
import type { LMModel } from '../llm/types'
import { ModelRow } from './ModelRow'

type ModelListProps = {
  models: LMModel[]
  loadingModelId: string | null
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ModelList({
  models,
  loadingModelId,
  onLoad,
  onUse,
}: ModelListProps) {
  return (
    <ul>
      {models.map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          isLoading={loadingModelId === model.id}
          onLoad={onLoad}
          onUse={onUse}
        />
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Implement `src/ui/ConnectionDialog.tsx`**

```tsx
import { useState } from 'react'
import type { ConnectionState } from './useConnection'
import { ModelList } from './ModelList'

type ConnectionDialogProps = {
  state: ConnectionState
  onConnect: (url: string) => void
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ConnectionDialog({
  state,
  onConnect,
  onLoad,
  onUse,
}: ConnectionDialogProps) {
  const [url, setUrl] = useState(state.baseUrl)
  return (
    <div>
      <h1>Connect to LM Studio</h1>
      <label>
        Server URL
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={state.phase === 'connecting'}
        onClick={() => onConnect(url)}
      >
        Connect
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.models.length > 0 && (
        <ModelList
          models={state.models}
          loadingModelId={state.loadingModelId}
          onLoad={onLoad}
          onUse={onUse}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/ConnectionDialog.test.tsx`
Expected: PASS — 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ModelList.tsx src/ui/ConnectionDialog.tsx src/ui/ConnectionDialog.test.tsx
git commit -m "feat(ui): add ConnectionDialog and ModelList"
```

---

### Task 8: `ConnectedView` + wire into `App` (`src/ui/ConnectedView.tsx`, `src/App.tsx`)

The post-USE screen and the top-level switch. This replaces the temporary `App` stub and its smoke test, and delivers the end-to-end flow.

**Files:**

- Create: `src/ui/ConnectedView.tsx`
- Test: `src/ui/ConnectedView.test.tsx`
- Modify: `src/App.tsx` (replace stub)
- Modify: `src/App.test.tsx` (replace the old smoke test)
- Remove: `src/ui/.gitkeep`

**Interfaces:**

- Consumes: `ConnectionDialog` (Task 7), `useConnection` (Task 5).
- Produces:
  - `ConnectedView(props: { baseUrl: string; activeModel: string; onChange(): void }): JSX.Element` — shows the active model id and base URL, and a `Change` button calling `onChange`.
  - `App(): JSX.Element` — calls `useConnection`; renders `ConnectedView` when `state.phase === 'ready'` (wiring `onChange` to `reset`), otherwise `ConnectionDialog` (wiring `onConnect`/`onLoad`/`onUse`).

- [ ] **Step 1: Write the failing test `src/ui/ConnectedView.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConnectedView } from './ConnectedView'

test('shows the active model and base url', () => {
  render(
    <ConnectedView
      baseUrl="http://localhost:1234"
      activeModel="google/gemma-4-e4b"
      onChange={() => {}}
    />,
  )
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
  expect(screen.getByText(/http:\/\/localhost:1234/)).toBeInTheDocument()
})

test('Change button calls onChange', async () => {
  const onChange = vi.fn()
  render(
    <ConnectedView
      baseUrl="http://localhost:1234"
      activeModel="m"
      onChange={onChange}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))
  expect(onChange).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Write the failing end-to-end test `src/App.test.tsx`** (replace the whole file)

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import * as client from './llm/client'
import type { LMModel } from './llm/types'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

test('connect then use switches to the connected view', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  const useButton = await screen.findByRole('button', { name: 'Use' })
  await userEvent.click(useButton)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument(),
  )
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/ui/ConnectedView.test.tsx src/App.test.tsx`
Expected: FAIL — cannot resolve `./ConnectedView`; `App` still renders the old stub.

- [ ] **Step 4: Implement `src/ui/ConnectedView.tsx`**

```tsx
type ConnectedViewProps = {
  baseUrl: string
  activeModel: string
  onChange: () => void
}

export function ConnectedView({
  baseUrl,
  activeModel,
  onChange,
}: ConnectedViewProps) {
  return (
    <div>
      <h1>LM Chess</h1>
      <p>
        Using <strong>{activeModel}</strong>
      </p>
      <p>Connected to {baseUrl}</p>
      <button type="button" onClick={onChange}>
        Change
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Replace `src/App.tsx`**

```tsx
import { ConnectionDialog } from './ui/ConnectionDialog'
import { ConnectedView } from './ui/ConnectedView'
import { useConnection } from './ui/useConnection'

export default function App() {
  const { state, connect, load, use, reset } = useConnection()

  if (state.phase === 'ready' && state.activeModel) {
    return (
      <ConnectedView
        baseUrl={state.baseUrl}
        activeModel={state.activeModel}
        onChange={reset}
      />
    )
  }

  return (
    <ConnectionDialog
      state={state}
      onConnect={connect}
      onLoad={load}
      onUse={use}
    />
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui/ConnectedView.test.tsx src/App.test.tsx`
Expected: PASS — ConnectedView 2 passed, App 1 passed.

- [ ] **Step 7: Full quality gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green, exit 0. If `format:check` fails, run `npm run format` and re-run. Fix any lint/type errors before committing.

- [ ] **Step 8: Commit**

```bash
git rm src/ui/.gitkeep
git add src/ui/ConnectedView.tsx src/ui/ConnectedView.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat(ui): wire connection flow into App with ConnectedView"
```

---

## Self-Review

**Spec coverage:**

- Dialog at launch, URL field, default `http://localhost:1234`, pre-fill from localStorage → Task 5 (initial state) + Task 7 (field) + Task 8 (App renders dialog). ✓
- `GET /api/v0/models`, filter to chat models, status → Task 3 (`listModels` + filter) + Task 2 (`isChatModel`). ✓
- Status badge loaded/not-loaded → Task 6 (`ModelRow`). ✓
- LOAD via JIT `POST /api/v0/chat/completions` → Task 4 (`loadModel`) + Task 5 (`load` refreshes). ✓
- USE enabled only for loaded, selects active model → Task 6 (button disabled logic) + Task 5 (`use`). ✓
- Final state / ConnectedView + Change → Task 8. ✓
- Error handling kinds (network/http/parse/empty), CORS message → Task 3 (all kinds) + Task 4 (network/http) + Task 5 (surfaces message) + Task 7 (renders error). ✓
- URL persisted, model not persisted → Task 5 (`localStorage.setItem` only for URL). ✓
- Module boundaries (llm = I/O, ui = React) → Tasks 1–4 vs 5–8; no React in `src/llm`, no `fetch` in `src/ui` (calls client). ✓
- No real network in tests → all tests mock `fetch` or the `client` module. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code and test step shows full content. ✓

**Type consistency:** `LMModel`, `LMStudioError`, `LMErrorKind`, `isChatModel` defined in Task 2 and imported unchanged in Tasks 3–6. `ConnectionState`/`Phase` defined in Task 5, imported in Tasks 7–8. `listModels`/`loadModel` signatures in Tasks 3–4 match their calls in Task 5. `ModelRow` props (Task 6) match `ModelList` usage (Task 7). `ConnectionDialog` props (Task 7) match `App` usage (Task 8). Storage key `lmchess.baseUrl` consistent between Task 5 impl and its test. ✓
