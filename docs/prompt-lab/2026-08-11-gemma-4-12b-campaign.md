# Prompt Lab campaign — `google/gemma-4-12b`

Date: 2026-08-11 (run overnight 2026-08-10 → 11)
Benchmark: `tools/prompt-lab/data/positions.json` (seed 42, 1000 positions
sampled from 151,855 unique positions across 2,305 Karpov games; screening
= first 150, final = first 600). One request per position, `temperature 0`,
no correction retries. Model served by LM Studio at `localhost:1234`,
`reasoning_effort: "none"` on every run (see Discovery).

## Verdict

**Winner: `v1-legal-list`** — include the legal-move list in the prompt and
ask the model to pick from it.

| variant (final, n=600) | match | ±se  | match+legal | illegal | unparseable | mean ms |
| ---------------------- | ----- | ---- | ----------- | ------- | ----------- | ------- |
| **v1-legal-list**      | 9.8%  | 1.2% | 94.7%       | 32      | 0           | 2401    |
| v4-cot                 | 9.5%  | 1.2% | 66.8%       | 199     | 0           | 8592    |
| v3-board               | 8.0%  | 1.1% | 60.0%       | 240     | 0           | 3021    |
| v0-baseline (control)  | 7.8%  | 1.1% | 60.5%       | 237     | 0           | 1982    |

Against the production control at equal n: **match 9.8% vs 7.8%** (a 2.0 pp
gain, larger than the winner's ±1.2 pp standard error) and — the real
product win — **legality 94.7% vs 60.5%**. With the production prompt the
model's first answer is illegal in ~40% of positions (triggering the
correction retry and often the random-move fallback); with the winner that
drops to ~5%. An adapter is justified (Task 14 criterion met).

## Discovery: gemma-4-12b is a reasoning model (production bug)

With the app's `max_tokens: 64`, every completion token goes to
`reasoning_content`; `content` comes back **empty** (`finish_reason:
length`). The harness scored 3/3 unparseable on first contact, and the
production app — same transport, same limit — degrades to its random-move
fallback against this model. Passing `"reasoning_effort": "none"` makes the
model answer directly (verified live: `content: "e4"`, `finish_reason:
stop`) and roughly halves latency (4.0 s → 1.8 s). The transports now
support an optional `reasoningEffort` passthrough end-to-end (commit
`cbb8229`); the gemma-4 adapter must set it.

## Round 1 — starter grid (race: screen 150 → keep 3 → final 600)

Screen results (n=150): v4-cot 10.0%/68.0%, v1-legal-list 9.3%/96.0%,
v3-board 9.3%/62.7%, v0-baseline 7.3%/64.0%, v5-fewshot 5.3%/50.7%,
v6-pgn-completion 2.0%/17.3% (44 unparseable), v2-uci 0.0% — 150/150
unparseable.

What round 1 taught:

- **The legal-move list nearly eliminates illegality** (96% match+legal) at
  no cost to accuracy. This directly attacks the production failure mode.
- **Brief chain-of-thought (v4) buys accuracy without a list** — it tied
  v1 on match — but stays 33% illegal and runs 3.6× slower.
- **UCI output (v2) is a total loss**: the model ignores the format
  instruction and answers in SAN (`b6`, `Rc2`, `Qxg5+`, …).
- **An ASCII board (v3) adds nothing** over FEN alone.
- **Few-shot examples (v5) actively hurt** (5.3% vs 7.3% control).
- **PGN-completion (v6) fails on a chat-tuned model** (17.3% match+legal)
  despite being the classic trick for base models.

## Claude-vs-model-vs-Karpov replays (failure analysis)

Replaying contested positions from the winner's failure log by hand showed
a consistent bias — the model reaches for checks, captures, and generic
developing moves where Karpov played quiet consolidating or prophylactic
moves:

- `6k1/2bQ1p2/p5pp/8/7N/P2pPNq1/1r4P1/7K w` — game **Qxd3** (kill the
  passer, consolidate); model **Qc8+**, a tempo-losing check.
- `3n3k/5bpp/pp6/4p3/2P3PP/NPnBBP2/P7/6K1 b` — game **b5**, the thematic
  queenside break; model **Nc6**, generic development.
- `r5k1/pQ3Rp1/1p2p2p/8/7P/q2N2P1/4K3/8 b` — game **Qa1!** heading for
  Qe1+ counterplay; model **Qxd3+??**, giving the queen for a knight
  because the move comes with check.

## Round 2 — targeted variants

Two variants attacked the observed biases (commit `bbb4256`):

| variant (screen, n=150)   | match | ±se  | match+legal | illegal | mean ms |
| ------------------------- | ----- | ---- | ----------- | ------- | ------- |
| v7-cot-legal (list+CoT)   | 9.3%  | 2.4% | **99.3%**   | 1       | 7637    |
| v8-karpov-legal (persona) | 8.7%  | 2.3% | **98.7%**   | 2       | 2710    |
| v1-legal-list (screen)    | 9.3%  | 2.4% | 96.0%       | 6       | 2366    |

Both push legality to ~99% but neither beats v1 on match beyond noise, and
v7 is 3× slower — not worth promoting to the final set or to the adapter
(with the app's 10-minute clock, 7.6 s/move is spendable but risky; 2.4 s
is comfortable). v7-style prompting is worth revisiting for **hints**,
which have no clock pressure.

## Adapter recommendation (implemented as Task 14)

`src/llm/adapters/gemma4.ts`, `matches: (id) => id.includes('gemma-4')`:

- Prompt: v1-legal-list — system: strong-grandmaster persona, pick the best
  move from the provided list, reply with ONLY the move in SAN; user:
  `Moves so far` + `Position (FEN)` + `Legal moves: <SAN list>` + side to
  move. (`MoveContext.legal` already carries the list in production.)
- `parseMoves`: `parseSanCandidates` (unchanged).
- `sampling: { temperature: 0, maxTokens: 64, reasoningEffort: 'none' }`.
- Production `selectMove` retry/correction and random fallback stay as the
  safety net — now needed in ~5% of positions instead of ~40%.

## Cost

~3,150 live requests total (round 1 race 2,400; round 2 750), ~2 h
wall-clock at 1.7–8.6 s/request. The response cache
(`tools/prompt-lab/results/google__gemma-4-12b/cache.jsonl`) makes every
re-run of these prompts free.
