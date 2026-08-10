# Prompt Lab — a prompt-optimization harness for the move-selection prompt

Date: 2026-08-10
Status: Design (approved by user, pending spec review)

## Context

The app plays chess against a local LM Studio model through a single generic
prompt (`src/llm/adapters/genericFen.ts`): FEN + SAN history in, one SAN move
out. That prompt was hand-written once and never measured. We now have a large
reference corpus — `karpov.pgn`, 2312 Anatoly Karpov games (ChessBase export;
1216 with Karpov as White, 1096 as Black; 752 `1-0`, 390 `0-1`, 1159 draws,
11 unfinished) — which lets us **measure** a prompt: replay each game with
chess.js, stop at a position, ask the model for the next move, and compare its
answer against the move actually played.

This cycle builds **Prompt Lab**: a standalone TypeScript CLI (a dev tool, not
part of the shipped app) that evaluates prompt variants against sampled
positions from `karpov.pgn`, plus an optimization campaign run with it for two
models, with the winning prompt per model wired back into the app as a real
`ModelAdapter`.

Target models (both present in the user's LM Studio):

1. `google/gemma-4-12b` (first)
2. `qwen/qwen3.5-9b` (second, same procedure)

### What exists today (relevant surfaces)

- `src/engine/` — pure chess.js wrapper (`newGame`/`move`/`legalMoves`), the
  sole judge of legality. chess.js 1.4.0 also ships `loadPgn()`/`history()` —
  no hand-written PGN move parser is needed, only a file splitter.
- `src/llm/chat.ts` — `chatCompletion` and `completion` transports over
  `fetch` against LM Studio's `/api/v0` REST API. `fetch` is native in
  Node 24, so these run unchanged outside the browser.
- `src/llm/client.ts` — model discovery (`listModels`) and load.
- `src/llm/adapters/` — the `ModelAdapter` strategy
  (`buildRequest`/`parseMoves`/`sampling`), `resolveAdapter(modelId)`
  registry, `parseSanCandidates`, and the `genericFen` default adapter whose
  prompt is the baseline to beat.
- `node_modules/.bin/vite-node` — already present via Vitest; runs a TS entry
  point directly. **No new dependencies.**
- LM Studio queues requests for a single loaded model — the harness runs
  sequentially; parallelism buys nothing.

## Decisions (from brainstorming)

1. **Positions:** all moves of **both sides** (the user's explicit choice —
   not Karpov-only), from all games. Deduplicate by FEN (ignoring the
   halfmove/fullmove counters) so common opening positions count once; drop
   positions with only one legal move (forced replies are free points).
2. **Budget:** a whole optimization campaign for one model fits in **1–2
   hours** (~1200–3000 requests at 2–4 s each). Achieved by screening on a
   small position set and promoting only finalists to a large one.
3. **Search loop:** Claude-in-the-loop with automatic culling. The program is
   a **pure evaluator**; Claude analyzes failure logs between runs, writes new
   variants, and re-runs. A `race` command automates screen → cull → final
   within one invocation.
4. **Deliverable:** the harness **and** the winning prompt per model wired
   into `src/llm/adapters` as a new adapter, so the app itself plays stronger.
5. **Claude as reference player:** the failure log is formatted so Claude can
   replay contested positions itself (ASCII board + FEN + history) and compare
   its own move against the model's and Karpov's — an analysis aid during
   iteration, not code.
6. **Scoring is single-shot:** one request per position, `temperature 0`, no
   correction retries (unlike production `selectMove`) — the prompt is being
   measured, not the retry scaffolding.

## Goal & metric

For each (model, prompt variant), over a fixed shared position set:

- **`match`** — the model's move equals the game move. Comparison is by
  **canonical SAN**: the candidate is applied to a chess.js clone and the
  SAN chess.js returns is compared to the SAN chess.js recorded for the game
  move. Never raw string comparison (`Nf3+` vs `Nf3`, `e8=Q` vs `e8Q`).
- **`legal`** — a legal move, but not the game move.
- **`illegal`** — parsed as a move-shaped token, but not legal here.
- **`unparseable`** — no move-shaped token found in the reply.

Primary metric: **match rate**. Tie-break: **match + legal** (i.e. fewest
illegal/unparseable). Reports also carry per-class counts, a crude ±
(binomial standard error), and latency stats.

## Architecture

```
tools/prompt-lab/
  cli.ts          # entry: sample | eval | race | compare
  pgn.ts          # split karpov.pgn into games; replay via chess.js loadPgn
  positions.ts    # extract (FEN, SAN history, expected move, meta) per ply
  sample.ts       # seeded PRNG; dedupe; emit the shared benchmark set
  variants/       # one file per prompt variant (v0-baseline.ts, ...)
    types.ts      # PromptVariant interface (mirrors ModelAdapter)
  evalRunner.ts   # single-shot loop: build → transport → parse → classify
  cache.ts        # response cache keyed by request hash; incremental writes
  race.ts         # screen N variants → cull bottom half → finalists on big set
  report.ts       # results JSON + failures.md + compare table
  data/
    positions.json  # committed shared benchmark (output of `sample`)
  results/          # gitignored: per-run reports, failures, cache
```

- Runs via a new npm script: `"prompt-lab": "vite-node tools/prompt-lab/cli.ts --"`.
- Imports `src/engine` and `src/llm/chat.ts` / `src/llm/client.ts` — reuse,
  in the allowed direction (the tool imports the app's libraries; `src/` never
  imports the tool). It is excluded from the Vite app build (only `src/` is
  bundled). Quality-gate coverage: a new composite project
  `tsconfig.tools.json` referenced from the root `tsconfig.json` puts
  `tools/` under `tsc -b` (build artifacts to `node_modules/.tmp/`, as the
  existing projects do); `eslint .` already reaches it (Node globals for
  `tools/` added to the flat config); Vitest picks up `tools/**/*.test.ts`
  (extend `include` if the config restricts it to `src/`).
- `karpov.pgn` stays **out of git** (1.8 MB ChessBase export): add to
  `.gitignore`; the file path is a CLI flag `--pgn` defaulting to
  `./karpov.pgn`. The derived `data/positions.json` **is committed** (~0.5 MB,
  generated once; listed in `.prettierignore` so `format:check` skips it) —
  it is the shared benchmark that makes runs comparable across sessions and
  models.

### Data flow

```
karpov.pgn ──sample──▶ data/positions.json (once, seeded, committed)
positions.json + variants/*.ts ──eval/race──▶ results/*.json + failures.md
failures.md ──Claude analyzes──▶ new variants/*.ts ──race──▶ winner
winner ──by hand──▶ src/llm/adapters/<model>.ts (+ tests) ──▶ the app
```

## Components

### `pgn.ts` — corpus reader

Splits the PGN file into individual games on `[Event "` header boundaries
(a new tag section after a game terminator), then replays each through
`chess.js` `loadPgn()`. Games chess.js rejects are skipped and counted; the
count is reported (a handful of the 2312 may be malformed or `Result "*"`).

### `positions.ts` — position extraction

For every ply of every parsed game: FEN **before** the move, SAN history so
far, the expected move in canonical SAN, side to move, ply number, and game
metadata (White, Black, Result, Date, ECO). Positions with exactly one legal
move are dropped here.

### `sample.ts` + `sample` command

`sample --pgn karpov.pgn --size 1000 --seed 42` — deterministic PRNG
(e.g. mulberry32), uniform over all extracted positions, **dedupe by FEN
minus move counters** (first occurrence wins), shuffle, truncate to `size`,
write `data/positions.json`. The screening set is a **prefix** of this list,
so a finalist's big run reuses every cached screening response. Regenerating
with the same seed and corpus reproduces the same file byte-for-byte.

### `variants/` — prompt variants

```ts
export type PromptVariant = {
  name: string // 'v1-legal-list'
  description: string // one line for reports
  buildRequest(ctx: PositionContext): ModelRequest // reuses src/llm type
  parse(reply: string): string[] // ordered SAN/UCI candidates
  sampling: { temperature: number; maxTokens: number }
}
```

`PositionContext` = `{ fen, historySan, turn, legalSan }` — note `legalSan`
is available here (a prompt-design dimension worth exploring) even though the
production default deliberately omits it. The interface deliberately mirrors
`ModelAdapter` so the winner ports to `src/llm/adapters` almost verbatim.

Starter grid (~7):

| Variant             | Idea                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `v0-baseline`       | the current `genericFen` prompt, unchanged (control), temp 0                                         |
| `v1-legal-list`     | include the legal-move list, ask to pick one                                                         |
| `v2-uci`            | answer in UCI (`e2e4`) instead of SAN                                                                |
| `v3-board`          | ASCII board diagram + FEN                                                                            |
| `v4-cot`            | "think briefly, last line = the move"; big maxTokens; parse the last move token                      |
| `v5-fewshot`        | 2–3 worked examples (position → move)                                                                |
| `v6-pgn-completion` | **completion transport**: feed the game as PGN movetext (`1. e4 e5 2. …`) and let the model continue |

Claude adds targeted variants between rounds based on the failure log.

### `evalRunner.ts` + `eval` command

`eval --model google/gemma-4-12b --prompt v1-legal-list --n 150
[--base-url http://localhost:1234]`

Sequentially, for each of the first `n` benchmark positions: build the
request → check the cache → if missed, call the transport → parse candidates
→ the **first legal candidate** is the model's move → classify
(`match`/`legal`/`illegal`/`unparseable`) → append to the incremental result
file. Latency is recorded per call. Before the run, verify via `client.ts`
that the model is loaded (load it if not).

### `cache.ts`

Key = SHA-256 of `(model, resolved ModelRequest JSON, sampling)`. Editing a
variant changes its built requests and thus invalidates exactly its own cache.
Values (raw reply + latency) are appended to a JSONL file under `results/`;
interrupted runs resume for free; re-runs of unchanged variants are free.

### `race.ts` + `race` command

`race --model <id> --variants v0,…,v6 --screen 150 --final 600 --keep 3` —
evaluate every variant on the first 150 positions, keep the top `--keep`
(default 3) by the ranking metric, evaluate survivors on the first 600
(screening responses come from cache), print the final table, declare the
winner. One `race` with the full starter grid: 7×150 + 3×450 = 2400 requests
≈ 1–2 h at a typical 1.5–3 s/request; Claude's follow-up rounds are cheaper
because unchanged variants are fully cached. Ranking is by accuracy only;
latency is reported so impractically slow variants (e.g. CoT) are visible.

### `report.ts` + `compare` command

- Per-run JSON: counts, rates, ±, latency percentiles, run config.
- `failures.md` per run: for every non-`match`, the ASCII board, FEN, last few
  SAN moves, expected move, full raw model reply, and classification —
  formatted for Claude to replay positions itself (decision 5).
- `compare` prints a ranked table across all stored runs for a model.

## Error handling

- Transport errors (`LMStudioError`): retry ×3 with exponential backoff, then
  abort the run with a clear message; the cache keeps everything already done.
- Per-request timeout 60 s via `AbortSignal` (the transports accept `signal`).
- Generous, per-variant `maxTokens` (reasoning-style models keep `content`
  empty until they finish thinking — a known LM Studio behavior).
- `Ctrl-C` mid-run loses at most the in-flight request (incremental writes).

## Wiring the winners into the app

Per model, a new adapter in `src/llm/adapters/` (e.g. `gemma4.ts`,
`qwen35.ts`): `matches(modelId)` by substring (`gemma-4`, `qwen3.5`),
`buildRequest`/`parseMoves` transplanted from the winning variant, registered
in `resolveAdapter` **before** the generic fallback. Production behavior
(correction retry, random-legal fallback in `selectMove`) is unchanged — only
the prompt and parser improve. Unit tests mirror `genericFen`'s.

If the winner for a model beats `v0-baseline` only within noise (≤ its ±),
no adapter is added for that model and the report says so — the generic
default stays.

## Testing (TDD)

Unit tests (Vitest, no live LM Studio — the network boundary stays mocked):

- `pgn.ts`: splitting multi-game files (headers containing quotes, comments,
  `*` results), skip-and-count on malformed games — small inline fixtures.
- `positions.ts`: extraction against a tiny known game; forced-move dropping.
- `sample.ts`: determinism (same seed → same output), FEN dedupe.
- SAN canonicalization: `Nf3+`/`Nf3`, `e8=Q` variants, UCI→SAN via chess.js.
- `cache.ts`: key stability, invalidation on request change, resume.
- `race.ts`: culling math on synthetic results.
- `report.ts`: rate/± arithmetic; failures.md rendering snapshot.
- `evalRunner.ts`: full loop over a mocked transport (canned replies →
  expected classifications).

The optimization campaigns themselves are **experiments, not tests** — their
outputs are reports, and the final numbers land in the results section of the
campaign report (a follow-up doc or PR description), not in CI.

## Out of scope

- No UI; no app-code changes beyond the two adapters + registry + tests.
- No request parallelism (LM Studio serializes per-model anyway).
- No statistics beyond counts and binomial ±.
- No campaigns for other models in this cycle (the tool makes them cheap
  later: `chesslm-0.01-llama-3.1-8b`, `gemma-4-12b-qat`, …).
- No automated prompt mutation — Claude authors variants.

## Success criteria

1. `npm run prompt-lab -- race --model google/gemma-4-12b` over the full
   starter grid completes a screen→final round unattended within the budget.
2. A committed benchmark (`data/positions.json`) and reproducible reports.
3. For each of `google/gemma-4-12b` and `qwen/qwen3.5-9b`: a documented
   winning prompt with measured match/legal rates vs the `v0-baseline`
   control, and (if it beats baseline beyond noise) a registered adapter with
   green tests.
4. The full local quality gate stays green
   (`lint / format:check / typecheck / test / build`).
