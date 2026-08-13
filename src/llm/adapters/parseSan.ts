// Shared SAN-extraction utility for completion-style adapter replies.

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g

// First-mentioned first: a completion continues the movetext, so the first
// token IS the move (later tokens are the model continuing the game).
export function parseFirstSan(reply: string): string[] {
  const out: string[] = []
  for (const m of reply.matchAll(SAN_RE)) {
    if (!out.includes(m[0])) out.push(m[0])
  }
  return out
}
