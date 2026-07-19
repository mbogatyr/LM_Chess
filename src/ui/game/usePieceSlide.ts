import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { SquareName } from '../../engine/types'
import { animateSlide } from './slideAnimation'

type LastMove = { from: SquareName; to: SquareName; san: string } | null

// Slide the piece that just moved. Fires once per new `lastMove` object
// (identity-keyed, so re-renders such as clock ticks don't re-trigger it) and
// never on the first render.
export function usePieceSlide(
  boardRef: RefObject<HTMLElement | null>,
  lastMove: LastMove,
): void {
  const prev = useRef<LastMove>(null)
  const mounted = useRef(false)

  useLayoutEffect(() => {
    if (
      mounted.current &&
      lastMove &&
      lastMove !== prev.current &&
      boardRef.current
    ) {
      animateSlide(boardRef.current, lastMove)
    }
    mounted.current = true
    prev.current = lastMove
  }, [lastMove, boardRef])
}
