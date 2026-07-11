# Design: LM Studio Connection Dialog

Date: 2026-07-11

## Context

LM_Chess needs its LLM "engine": a local model served by LM Studio, reached
over HTTP from the browser. Before any chess feature can use a model, the app
must let the user (1) point at an LM Studio server, (2) see the available
chat-capable models and their load state, (3) load a model into memory, and
(4) select one as the active model for the app.

This spec covers **only** that connection-and-model-selection flow — the LLM
HTTP client (`src/llm`), the connection dialog UI (`src/ui`), and the
connection state that ties them together. The chess board, the chess.js
engine, and actually sending chess prompts to the model are out of scope and
come in later specs.

## API findings (verified against a live LM Studio, 2026-07-11)

The design is grounded in the real behavior of LM Studio's REST API at
`http://<host>:<port>`, probed against a running instance:

- **`GET /api/v0/models`** returns
  `{ "object": "list", "data": [ { id, object, type, publisher, arch,
compatibility_type, quantization, state, max_context_length,
capabilities? } ] }`.
  - `type` is one of `llm`, `vlm`, `embeddings` (others possible).
  - `state` is `not-loaded` or `loaded` (a transient `loading` may occur).
  - This is the **only** endpoint that reports model load `state` and `type`.
- **`GET /api/v0/models/{id}`** returns a single model with the same shape.
- **There is no REST endpoint to explicitly load or unload a model.** Unknown
  routes return HTTP 200 with a body `{"error":"Unexpected endpoint or
method. (…)"}` — so route existence cannot be inferred from status code,
  only from the error body.
- **Model loading is possible only via JIT (Just-In-Time) loading**: a
  `POST /api/v0/chat/completions` naming a `not-loaded` model causes LM Studio
  to load it into memory, then answer. Verified: a request for
  `google/gemma-4-e4b` with `max_tokens: 1` moved its `state` from
  `not-loaded` to `loaded` in ~25s. **There is no way to unload via REST.**
- The OpenAI-compatible **`GET /v1/models`** returns only `{id, object,
owned_by}` — no `state`, no `type`. Therefore v1 cannot drive the
  status-aware model list, and this design uses **`/api/v0` throughout**.
- **CORS:** the app runs in a browser, so LM Studio must send CORS headers for
  the app's origin. LM Studio has a server setting to enable CORS. This is a
  runtime prerequisite and a first-class error case (see Error Handling).

## Decisions (from brainstorming)

- **API: `/api/v0` for everything** — listing (needs `state`/`type`), loading
  (JIT), and any inference.
- **Two-step LOAD then USE.** `LOAD` puts a `not-loaded` model into memory via
  JIT; `USE` is enabled only for `loaded` models and selects the active model.
- **Show chat-capable models only** — filter `type` to `llm`/`vlm`; hide
  `embeddings` and other non-chat types.
- **Dialog appears at every launch.** The URL field defaults to
  `http://localhost:1234` and is pre-filled with the last successfully-used
  URL, persisted in `localStorage`. Only the URL is persisted — not the model
  selection.
- **Architecture: Approach A** — a pure `src/llm` HTTP client (mockable network
  boundary) + a `src/ui` component tree with a `useConnection` hook
  (`useReducer` for flow phases). No state-machine library (YAGNI).

## Architecture / Module structure

```
src/
  llm/
    types.ts        # LMModel, LMModelType, LMModelState, error types
    client.ts       # listModels(baseUrl), loadModel(baseUrl, id) over fetch
    url.ts          # normalizeBaseUrl(input): trim, add scheme, strip trailing /
  ui/
    useConnection.ts       # useReducer hook: phases, actions, localStorage
    ConnectionDialog.tsx   # URL field + Connect + errors; hosts ModelList
    ModelList.tsx          # renders ModelRow[] from models
    ModelRow.tsx           # one model: id, type, status badge, LOAD/USE buttons
    ConnectedView.tsx      # post-USE screen: active model + URL + "Change"
  App.tsx           # renders ConnectionDialog until a model is USEd, else ConnectedView
```

Boundaries: `src/llm` knows HTTP and nothing about React; `src/ui` knows React
and calls `src/llm` through its typed interface. `App.tsx` is the top-level
switch between "not yet connected/selected" and "connected".

## Component / Data flow

1. **Launch** → `App` shows `ConnectionDialog`. URL field = last-used URL from
   `localStorage`, else `http://localhost:1234`.
2. **Connect** → `useConnection.connect(url)` normalizes the URL, sets phase
   `connecting`, calls `listModels(url)`.
   - On success: persist URL to `localStorage`, filter to chat models, set
     phase `connected`, store `models`.
   - On failure: phase `error` with a typed message; stay on the dialog.
3. **Model list** → each `ModelRow` shows `id`, `type`, and a status badge
   (`loaded` / `not-loaded`).
   - `not-loaded` row → **LOAD** button enabled; **USE** disabled.
   - `loaded` row → **USE** button enabled; **LOAD** hidden/disabled.
4. **LOAD** → `useConnection.load(id)` sets that row to a loading spinner,
   calls `loadModel(url, id)` (JIT). On success, re-fetch `listModels` (or
   re-fetch the single model) so the row flips to `loaded`. On failure, show a
   row-level error; state unchanged.
5. **USE** → `useConnection.use(id)` sets `activeModel = id`, phase `ready`.
   `App` switches to `ConnectedView`.
6. **ConnectedView** shows the active model id and base URL, with a **Change**
   button that returns to the dialog: `reset()` clears `activeModel`, sets
   phase back to `connected`, and preserves the already-fetched `models` so the
   list reappears without re-connecting.

### Connection state (`useConnection`)

```ts
type Phase = 'idle' | 'connecting' | 'connected' | 'ready' | 'error'
type State = {
  baseUrl: string
  phase: Phase
  models: LMModel[]
  loadingModelId: string | null // row-level LOAD in progress
  activeModel: string | null
  error: string | null
}
// actions: connect(url), load(id), use(id), reset()
```

## `src/llm` interface

```ts
type LMModelType = 'llm' | 'vlm' | 'embeddings' | string
type LMModelState = 'loaded' | 'not-loaded' | 'loading' | string

type LMModel = {
  id: string
  type: LMModelType
  state: LMModelState
  quantization?: string
  maxContextLength?: number
  capabilities?: string[]
}

// GET /api/v0/models → parse, keep only chat types (llm, vlm)
listModels(baseUrl: string): Promise<LMModel[]>

// JIT load: POST /api/v0/chat/completions
//   { model: id, messages: [{ role: 'user', content: ' ' }], max_tokens: 1 }
// resolves when the model is loaded and the request returns 2xx
loadModel(baseUrl: string, id: string): Promise<void>
```

Errors are thrown as a typed `LMStudioError` with a `kind`
(`'network' | 'http' | 'parse' | 'empty'`) and a human-readable message, so the
UI can render actionable text (e.g. network/CORS → "Can't reach LM Studio at
<url>. Check the URL and that CORS is enabled in LM Studio.").

## Error handling

| Case                                                 | Handling                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| Bad URL / server down / CORS blocked (fetch rejects) | `kind: 'network'`; dialog shows retryable error; stay on dialog |
| Non-2xx from `/api/v0/models`                        | `kind: 'http'` with status; dialog error                        |
| Malformed JSON                                       | `kind: 'parse'`; dialog error                                   |
| No chat-capable models after filtering               | `kind: 'empty'`; dialog shows "No chat models available"        |
| LOAD (JIT) fails or times out                        | row-level error; model stays `not-loaded`; rest of list usable  |

Note: because the browser cannot distinguish a true network failure from a
CORS rejection, the `network` message names both possibilities.

## Testing strategy

- **`src/llm` unit tests** with a mocked `fetch` (no real network — per
  CLAUDE.md): `listModels` parses the documented shape and filters to
  chat types; `loadModel` issues the exact JIT request; each error `kind` is
  produced for the matching failure; `normalizeBaseUrl` handles missing
  scheme, trailing slash, whitespace.
- **`src/ui` component tests** with a mocked `src/llm` module (Testing
  Library): dialog renders the default URL; Connect renders the model list;
  a `not-loaded` row enables LOAD and disables USE; LOAD shows a spinner and
  flips the row to `loaded` on success; USE is enabled only when `loaded` and
  switches to `ConnectedView`; errors render.
- **No real LM Studio in automated tests.** Final manual verification runs the
  dev server against the live LM Studio at `http://localhost:1234` and drives
  the flow with `google/gemma-4-e4b`.

## Out of scope (this spec)

- Chessboard UI and chess.js engine.
- Sending chess prompts / streaming responses / any gameplay.
- Persisting the selected model across sessions (only the URL is persisted).
- Unloading models (no REST endpoint exists).
- Multiple simultaneous servers or model comparison.
