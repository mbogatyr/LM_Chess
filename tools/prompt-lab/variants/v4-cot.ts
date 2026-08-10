import { parseSanCandidates } from '../../../src/llm/adapters/genericFen'
import type { PromptVariant } from './types'

// Regex to detect SAN-shaped tokens in text
const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/

export function parseFinalLineSan(reply: string): string[] {
  const lines = reply
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const last = lines[lines.length - 1] ?? ''
  // Only use the last line if it actually contains a SAN-shaped token
  const lastHasSan = SAN_RE.test(last)
  if (lastHasSan) {
    return parseSanCandidates(last)
  }
  // Fall back to parsing the whole reply
  return parseSanCandidates(reply)
}

const SYSTEM =
  'You are a strong chess grandmaster. Think about the position step by ' +
  'step — candidate moves, tactics, threats — in at most 100 words. Then ' +
  'write your final chosen move ALONE on the last line, in Standard ' +
  'Algebraic Notation (SAN).'

export const v4Cot: PromptVariant = {
  name: 'v4-cot',
  description: 'Brief chain-of-thought, final move on the last line',
  buildRequest: (ctx) => ({
    kind: 'chat',
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          (ctx.state.history.length > 0
            ? `Moves so far: ${ctx.state.history.join(' ')}\n`
            : '') +
          `Position (FEN): ${ctx.state.fen}\n` +
          `It is ${ctx.state.turn === 'w' ? 'White' : 'Black'}'s turn.`,
      },
    ],
  }),
  parse: parseFinalLineSan,
  sampling: { temperature: 0, maxTokens: 512 },
}
