import { useRef } from 'react'
import type { Square, SquareName } from '../../engine/types'
import type { BoardStyle, PieceStyle } from '../app/appState'
import type { LegalTarget } from './useGame'
import { sqName, FILES } from './chessDemo'
import { Piece } from './Piece'
import { usePieceSlide } from './usePieceSlide'

export function Board({
  board,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  hintMove,
  onSquareClick,
  boardStyle,
  pieceStyle,
}: {
  board: Square[][]
  selected: SquareName | null
  legalTargets: LegalTarget[]
  lastMove: { from: SquareName; to: SquareName; san: string } | null
  checkSquare: SquareName | null
  hintMove?: { from: SquareName; to: SquareName } | null
  onSquareClick: (sq: SquareName) => void
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  const boardRef = useRef<HTMLDivElement>(null)
  usePieceSlide(boardRef, lastMove)

  return (
    <div className={`board-wrap pieces--${pieceStyle}`}>
      <div className={`board board--${boardStyle}`} ref={boardRef}>
        {board.flatMap((row, r) =>
          row.map((piece, c) => {
            const name = sqName(r, c)
            const light = (r + c) % 2 === 0
            const target = legalTargets.find((t) => t.to === name)
            const classes = ['sq', light ? 'light' : 'dark']
            if (name === selected) classes.push('sel')
            if (lastMove && (name === lastMove.from || name === lastMove.to))
              classes.push('last')
            if (name === checkSquare) classes.push('check')
            if (hintMove && name === hintMove.from) classes.push('hint1')
            if (hintMove && name === hintMove.to) classes.push('hint-target')
            if (target) classes.push('legal')
            if (target?.capture) classes.push('capture')
            return (
              <div
                key={name}
                className={classes.join(' ')}
                data-sq={name}
                onClick={() => onSquareClick(name)}
              >
                {c === 0 && <span className="coord rank">{8 - r}</span>}
                {r === 7 && <span className="coord file">{FILES[c]}</span>}
                {target && !target.capture && <span className="marker dot" />}
                {piece && <Piece color={piece.color} type={piece.type} />}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}
