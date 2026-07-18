// Real match-history persistence. Finished games are stored newest-first in
// localStorage; the History screen and its stats read from here. Pure module —
// no React, no LLM.

export type MatchResult = 'win' | 'loss' | 'draw' // human (White) perspective

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'fifty-move'
  | 'threefold'
  | 'insufficient-material'
  | 'timeout'
  | 'resignation'

export type GameRecord = {
  id: string
  endedAt: number // Date.now() epoch ms — date column + sort key
  opponent: string
  elo: number
  plies: number
  result: MatchResult
  reason: EndReason
}

export type GameStats = {
  played: number
  winRate: number
  streak: number
  best: number
}

const KEY = 'nocturne-chess-games'
const CAP = 50

export function loadGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GameRecord[]) : []
  } catch {
    return []
  }
}

export function appendGame(rec: GameRecord): void {
  const next = [rec, ...loadGames()].slice(0, CAP)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage full/unavailable — history is best-effort, drop silently
  }
}

export function gameStats(games: GameRecord[]): GameStats {
  const played = games.length
  if (played === 0) return { played: 0, winRate: 0, streak: 0, best: 0 }
  const wins = games.filter((g) => g.result === 'win').length
  const winRate = Math.round((wins / played) * 100)
  let streak = 0
  for (const g of games) {
    if (g.result === 'win') streak++
    else break
  }
  const best = Math.max(...games.map((g) => g.elo))
  return { played, winRate, streak, best }
}
