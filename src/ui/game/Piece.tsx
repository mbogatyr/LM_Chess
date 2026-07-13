import { PIECE_SVGS, type Color, type PieceType } from './pieceSvgs'

export function Piece({ color, type }: { color: Color; type: PieceType }) {
  const s = PIECE_SVGS[type]
  return (
    <span className={`piece ${color}`}>
      <svg
        className={`cp cp-${type}`}
        viewBox={s.vb}
        aria-hidden="true"
        // Safe: `inner` is a trusted build-time constant (ported piece
        // artwork from pieceSvgs), not user input, so there's no XSS surface.
        dangerouslySetInnerHTML={{ __html: s.inner }}
      />
    </span>
  )
}
