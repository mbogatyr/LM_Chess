// Brand logo — a low-poly "neural network" knight in the accent hue.
// LOGO_NODES/LOGO_EDGES ported verbatim from docs/design-reference/gambit-local/app/main.js (logoSVG()).
const LOGO_NODES: [number, number][] = [
  [53, 19],
  [45, 25],
  [62, 29],
  [42, 35],
  [75, 41],
  [59, 43],
  [81, 53],
  [67, 52],
  [55, 55],
  [45, 50],
  [39, 49],
  [51, 67],
  [44, 74],
  [60, 71],
  [40, 85],
  [54, 86],
  [67, 83],
]

const LOGO_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [2, 5],
  [4, 6],
  [5, 7],
  [6, 7],
  [5, 8],
  [7, 8],
  [3, 10],
  [1, 10],
  [3, 5],
  [9, 10],
  [8, 9],
  [8, 11],
  [9, 11],
  [11, 12],
  [11, 13],
  [12, 14],
  [12, 15],
  [13, 15],
  [13, 16],
  [14, 15],
  [15, 16],
  [10, 12],
  [0, 3],
  [4, 7],
  [8, 13],
]

export function Logo() {
  return (
    <span className="mark">
      <svg className="logo-mark" viewBox="0 0 100 100" aria-hidden>
        <g className="lg-lines">
          {LOGO_EDGES.map(([a, b], i) => {
            const [x1, y1] = LOGO_NODES[a]
            const [x2, y2] = LOGO_NODES[b]
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          })}
        </g>
        <g className="lg-dots">
          {LOGO_NODES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 1.7} />
          ))}
        </g>
      </svg>
    </span>
  )
}
