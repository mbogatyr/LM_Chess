import { PIECE_SVGS, type Color, type PieceType } from './pieceSvgs'

export function Piece({ color, type }: { color: Color; type: PieceType }) {
  const s = PIECE_SVGS[type]
  return (
    <span className={`piece ${color}`}>
      <svg
        className={`cp cp-${type}`}
        viewBox={s.vb}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: s.inner }}
      />
    </span>
  )
}
