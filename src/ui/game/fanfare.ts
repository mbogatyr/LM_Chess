// A short but full-bodied synthesized fanfare via the Web Audio API — no asset,
// no dependency. playFanfare() lazily creates/resumes a shared AudioContext and
// plays a rising arpeggio resolving into a sustained major chord, each note
// layered (saw + triangle, lightly detuned) through a compressor for punch.
// Everything is guarded: if Web Audio is unavailable or the context can't
// resume (autoplay policy), it silently no-ops.

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

// One "voice": a fundamental plus a slightly detuned second oscillator for
// chorus/thickness, with a quick attack and exponential release.
function voice(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  peak: number,
): void {
  const gain = audio.createGain()
  gain.connect(dest)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)

  const layers: Array<{ type: OscillatorType; detune: number; level: number }> =
    [
      { type: 'sawtooth', detune: -6, level: 0.55 },
      { type: 'sawtooth', detune: 6, level: 0.55 },
      { type: 'triangle', detune: 0, level: 1 },
    ]
  for (const layer of layers) {
    const osc = audio.createOscillator()
    const lg = audio.createGain()
    lg.gain.value = layer.level
    osc.type = layer.type
    osc.frequency.value = freq
    osc.detune.value = layer.detune
    osc.connect(lg).connect(gain)
    osc.start(start)
    osc.stop(start + dur + 0.05)
  }
}

// Notes (Hz). Rising arpeggio G4→C5→E5→G5, then a held C-major chord with a
// low C for body and a bright top C.
const ARP = [392.0, 523.25, 659.25, 783.99]
const CHORD = [130.81, 261.63, 523.25, 659.25, 783.99, 1046.5]
const STEP = 0.1 // seconds between arpeggio notes

export function playFanfare(): void {
  const audio = getContext()
  if (!audio) return
  if (audio.state === 'suspended') void audio.resume().catch(() => {})

  // Master bus: a gentle compressor glues the voices and adds punch/loudness
  // without clipping, then a master gain to the speakers.
  const comp = audio.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 24
  comp.ratio.value = 3
  comp.attack.value = 0.003
  comp.release.value = 0.25
  const master = audio.createGain()
  master.gain.value = 0.85
  comp.connect(master).connect(audio.destination)

  const now = audio.currentTime + 0.02

  // Rising arpeggio.
  ARP.forEach((freq, i) => {
    voice(audio, comp, freq, now + i * STEP, 0.45, 0.5)
  })

  // Sustained triumphant chord landing on the last arpeggio beat.
  const chordStart = now + ARP.length * STEP
  CHORD.forEach((freq, i) => {
    // Bass and top a touch quieter so the mid triad stays present.
    const peak = i === 0 ? 0.4 : i === CHORD.length - 1 ? 0.32 : 0.5
    voice(audio, comp, freq, chordStart, 1.7, peak)
  })
}
