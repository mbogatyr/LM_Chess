import { Chess } from 'chess.js'
import type {
  Color,
  DrawReason,
  GameResult,
  GameState,
  GameStatus,
  LegalMove,
  MoveInput,
  PromotionPiece,
  Square,
  SquareName,
} from './types'

// Rebuild a mutable Chess from an immutable snapshot by replaying the SAN
// history from the base position. Replaying (rather than `new Chess(state.fen)`)
// is required so chess.js retains the full position history and can detect
// threefold repetition — a single FEN does not encode it.
function hydrate(state: GameState): Chess {
  const chess = new Chess(state.initialFen)
  for (const san of state.history) chess.move(san)
  return chess
}

function mapBoard(chess: Chess): Square[][] {
  return chess
    .board()
    .map((row) =>
      row.map((cell) => (cell ? { color: cell.color, type: cell.type } : null)),
    )
}

function computeStatus(chess: Chess): GameStatus {
  const isCheckmate = chess.isCheckmate()
  const isStalemate = chess.isStalemate()
  const isDraw = chess.isDraw()
  const isGameOver = chess.isGameOver()

  let result: GameResult = 'ongoing'
  if (isCheckmate) {
    // The side to move has been mated, so the other side won.
    result = chess.turn() === 'w' ? 'black' : 'white'
  } else if (isDraw) {
    result = 'draw'
  }

  let drawReason: DrawReason = null
  if (isDraw) {
    if (isStalemate) drawReason = 'stalemate'
    else if (chess.isThreefoldRepetition()) drawReason = 'threefold'
    else if (chess.isInsufficientMaterial())
      drawReason = 'insufficient-material'
    else drawReason = 'fifty-move'
  }

  return {
    isCheck: chess.inCheck(),
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver,
    result,
    drawReason,
  }
}

// Build an immutable snapshot from a hydrated Chess instance.
function snapshot(chess: Chess, initialFen: string): GameState {
  const verbose = chess.history({ verbose: true })
  const last = verbose.at(-1)
  return {
    initialFen,
    fen: chess.fen(),
    turn: chess.turn() as Color,
    board: mapBoard(chess),
    history: chess.history(),
    lastMove: last ? { from: last.from, to: last.to, san: last.san } : null,
    status: computeStatus(chess),
  }
}

export function newGame(fen?: string): GameState {
  const chess = fen ? new Chess(fen) : new Chess()
  return snapshot(chess, fen ?? chess.fen())
}

export function legalMoves(state: GameState, from?: SquareName): LegalMove[] {
  const chess = hydrate(state)
  // chess.moves({ square }) types the square as chess.js's own branded
  // `Square` union; `as never` bridges our SquareName (string) to it without
  // leaking the chess.js type into our public API. An out-of-range square
  // yields [].
  const moves = from
    ? chess.moves({ square: from as never, verbose: true })
    : chess.moves({ verbose: true })
  return moves.map((m) => ({
    from: m.from,
    to: m.to,
    san: m.san,
    // chess.js types `promotion` as its full `PieceSymbol` (incl. 'p'/'k'),
    // but a promotion move can only ever report one of q/r/b/n at runtime.
    ...(m.promotion ? { promotion: m.promotion as PromotionPiece } : {}),
  }))
}

export function move(state: GameState, m: MoveInput): GameState | null {
  const chess = hydrate(state)
  try {
    // chess.js v1.x throws on an illegal/unparseable move.
    const applied = chess.move(m as never)
    if (!applied) return null
  } catch {
    return null
  }
  return snapshot(chess, state.initialFen)
}
