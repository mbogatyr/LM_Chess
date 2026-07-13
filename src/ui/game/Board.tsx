import type { BoardStyle, PieceStyle } from '../app/appState'
import {
  START_POSITION,
  sqName,
  nameToRC,
  FILES,
  HINT,
  HINT_LEGAL,
  type HintLevel,
} from './chessDemo'
import { Piece } from './Piece'

function Arrow() {
  const [fr, fc] = nameToRC(HINT.from)
  const [tr, tc] = nameToRC(HINT.to)
  const u = 12.5 // percent per square (100 / 8)
  const cx = (c: number) => (c + 0.5) * u
  const cy = (r: number) => (r + 0.5) * u
  const x1 = cx(fc)
  const y1 = cy(fr)
  const x2 = cx(tc)
  const y2 = cy(tr)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ex = x2 - (dx / len) * 4.5
  const ey = y2 - (dy / len) * 4.5
  const accent = 'var(--color-accent)'
  return (
    <svg className="arrows" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker
          id="ah"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
        >
          <polygon points="0,0 4,2 0,4" style={{ fill: accent }} />
        </marker>
      </defs>
      <path
        d={`M${x1},${y1} L${ex},${ey}`}
        markerEnd="url(#ah)"
        style={{
          stroke: accent,
          strokeWidth: 2.4,
          fill: 'none',
          strokeLinecap: 'round',
          filter: `drop-shadow(0 0 3px ${accent})`,
        }}
      />
    </svg>
  )
}

export function Board({
  hintLevel,
  boardStyle,
  pieceStyle,
}: {
  hintLevel: HintLevel
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  return (
    <div className={`board-wrap pieces--${pieceStyle}`}>
      <div className={`board board--${boardStyle}`}>
        {START_POSITION.flatMap((row, r) =>
          row.map((piece, c) => {
            const name = sqName(r, c)
            const light = (r + c) % 2 === 0
            const isLegal = hintLevel === 3 && HINT_LEGAL.includes(name)
            const classes = ['sq', light ? 'light' : 'dark']
            if (hintLevel >= 1 && name === HINT.piece) classes.push('hint1')
            if (hintLevel === 2 && HINT.targets.includes(name))
              classes.push('hint-target')
            if (hintLevel === 3 && name === HINT.piece) classes.push('sel')
            if (isLegal) classes.push('legal')
            return (
              <div key={name} className={classes.join(' ')} data-sq={name}>
                {c === 0 && <span className="coord rank">{8 - r}</span>}
                {r === 7 && <span className="coord file">{FILES[c]}</span>}
                {isLegal && <span className="marker dot" />}
                {piece && <Piece color={piece.color} type={piece.type} />}
              </div>
            )
          }),
        )}
      </div>
      {hintLevel === 3 && <Arrow />}
    </div>
  )
}
