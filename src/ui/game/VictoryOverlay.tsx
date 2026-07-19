import { useEffect, useRef } from 'react'
import { useI18n } from '../app/i18n'
import { runFireworks as realRunFireworks } from './fireworks'
import { playFanfare as realPlayFanfare } from './fanfare'
import { useSoundPref } from './useSoundPref'

// A celebratory overlay shown over the board when the human wins: a canvas
// fireworks burst plus a one-shot fanfare (unless muted). The canvas is inert
// (pointer-events: none); the only interactive control is the sound toggle.
export function VictoryOverlay({
  runFireworksFn = realRunFireworks,
  playFanfareFn = realPlayFanfare,
}: {
  runFireworksFn?: (canvas: HTMLCanvasElement) => () => void
  playFanfareFn?: () => void
}) {
  const { t } = useI18n()
  const { muted, toggle } = useSoundPref()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read the current mute at mount time without re-firing on toggle.
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stop = runFireworksFn(canvas)
    if (!mutedRef.current) playFanfareFn()
    return stop
    // Fire exactly once per win — the overlay mounts when the game is won and
    // unmounts on New Game, so an empty dep list is the intended "once".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="victory" aria-hidden="false">
      <canvas ref={canvasRef} className="victory-canvas" />
      <button
        type="button"
        className="victory-sound"
        aria-label={muted ? t('sound_off') : t('sound_on')}
        onClick={toggle}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  )
}
