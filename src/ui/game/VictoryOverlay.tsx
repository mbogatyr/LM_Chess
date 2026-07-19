import { useEffect, useRef } from 'react'
import { runFireworks as realRunFireworks } from './fireworks'
import { playFanfare as realPlayFanfare } from './fanfare'

// A celebratory overlay shown over the board when the human wins: a canvas
// fireworks burst plus a one-shot fanfare. The canvas is inert
// (pointer-events: none) and there are no controls.
export function VictoryOverlay({
  runFireworksFn = realRunFireworks,
  playFanfareFn = realPlayFanfare,
}: {
  runFireworksFn?: (canvas: HTMLCanvasElement) => () => void
  playFanfareFn?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stop = runFireworksFn(canvas)
    playFanfareFn()
    return stop
    // Fire exactly once per win — the overlay mounts when the game is won and
    // unmounts on New Game, so an empty dep list is the intended "once".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="victory" aria-hidden="true">
      <canvas ref={canvasRef} className="victory-canvas" />
    </div>
  )
}
