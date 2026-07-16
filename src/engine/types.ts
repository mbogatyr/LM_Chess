// Canonical chess domain types. src/engine is the single source of truth for
// game state; ui/ and llm/ import these rather than re-declaring them.

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

// One board square: an occupied square carries a piece, an empty square is null.
export type Square = { color: Color; type: PieceType } | null

// Algebraic square name, e.g. 'e4'.
export type SquareName = string

// A move to apply: either coordinates (what the board produces from clicks) or
// a SAN string (what the LLM emits), e.g. 'Nf3', 'e4', 'O-O', 'exd8=Q'.
export type MoveInput =
  { from: SquareName; to: SquareName; promotion?: PromotionPiece } | string

export type LegalMove = {
  from: SquareName
  to: SquareName
  san: string
  promotion?: PromotionPiece
}

export type GameResult = 'white' | 'black' | 'draw' | 'ongoing'

export type DrawReason =
  'stalemate' | 'fifty-move' | 'threefold' | 'insufficient-material' | null

export type GameStatus = {
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isGameOver: boolean
  result: GameResult
  drawReason: DrawReason
}

export type GameState = {
  initialFen: string // base position (start, or a custom FEN passed to newGame)
  fen: string // current position
  turn: Color
  board: Square[][] // rank 8 first, file a first — ready for Board.tsx
  history: string[] // SAN of each move played, in order
  lastMove: { from: SquareName; to: SquareName; san: string } | null
  status: GameStatus
}
