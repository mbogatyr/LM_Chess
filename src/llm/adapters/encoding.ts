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
