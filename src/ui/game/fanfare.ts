// A short synthesized fanfare via the Web Audio API — no asset, no dependency.
// playFanfare() lazily creates/resumes a shared AudioContext and plays a rising
// triad arpeggio with a soft envelope. Everything is guarded: if Web Audio is
// unavailable or the context can't resume (autoplay policy), it silently no-ops.

type WindowWithAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (ctx) return ctx
  const w = window as WindowWithAudio
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

// A major triad arpeggio resolving up to the octave (C5 E5 G5 C6), in Hz.
const NOTES = [523.25, 659.25, 783.99, 1046.5]
const NOTE_MS = 140

export function playFanfare(): void {
  const audio = getContext()
  if (!audio) return
  // Resume if the browser suspended it until a user gesture.
  if (audio.state === 'suspended') void audio.resume().catch(() => {})

  const now = audio.currentTime
  NOTES.forEach((freq, i) => {
    const start = now + (i * NOTE_MS) / 1000
    const dur = (i === NOTES.length - 1 ? 3.2 : 1.4) * (NOTE_MS / 1000)
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    // Quick attack, gentle exponential release.
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  })
}
