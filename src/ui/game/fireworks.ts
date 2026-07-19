// Imperative canvas fireworks: a few particle bursts with gravity + fade.
// runFireworks(canvas) starts the animation and returns a stop() that cancels
// it and clears the canvas. Self-terminates once the last burst has faded.

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 → 0
  hue: number
}

const GRAVITY = 0.03 // px per frame², in canvas units
const DRAG = 0.985
const FADE = 0.012 // life lost per frame
const BURSTS = 4
const PARTICLES_PER_BURST = 44
const BURST_INTERVAL_MS = 320

export function runFireworks(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  // Size the backing store to the element, accounting for DPR.
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth || canvas.width || 320
  const h = canvas.clientHeight || canvas.height || 320
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.scale(dpr, dpr)

  const particles: Particle[] = []
  let raf = 0
  const timers: ReturnType<typeof setTimeout>[] = []
  let stopped = false

  const burst = () => {
    if (stopped) return
    const cx = w * (0.25 + Math.random() * 0.5)
    const cy = h * (0.2 + Math.random() * 0.4)
    const baseHue = Math.floor(Math.random() * 360)
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const angle =
        (Math.PI * 2 * i) / PARTICLES_PER_BURST + Math.random() * 0.2
      const speed = 1.6 + Math.random() * 2.6
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: baseHue + Math.random() * 40 - 20,
      })
    }
  }

  const frame = () => {
    if (stopped) return
    ctx.clearRect(0, 0, w, h)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.vx *= DRAG
      p.vy = p.vy * DRAG + GRAVITY
      p.x += p.vx
      p.y += p.vy
      p.life -= FADE
      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = `hsl(${p.hue}, 90%, 62%)`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (particles.length > 0) {
      raf = requestAnimationFrame(frame)
    } else {
      raf = 0
    }
  }

  // Schedule the bursts; kick the animation loop after the first burst.
  for (let b = 0; b < BURSTS; b++) {
    timers.push(
      setTimeout(() => {
        burst()
        if (!raf && !stopped) raf = requestAnimationFrame(frame)
      }, b * BURST_INTERVAL_MS),
    )
  }

  return () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    timers.forEach(clearTimeout)
    ctx.clearRect(0, 0, w, h)
  }
}
