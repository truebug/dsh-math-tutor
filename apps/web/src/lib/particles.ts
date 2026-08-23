// Canvas 2D 轻量粒子：星星雨（通关）与余烬（连击），尊重 prefers-reduced-motion

export type ParticleKind = 'stars' | 'embers'

interface P {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; hue: number
}

export function burst(canvas: HTMLCanvasElement, kind: ParticleKind, count = 60): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const { width: w, height: h } = canvas.getBoundingClientRect()
  canvas.width = w * devicePixelRatio
  canvas.height = h * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)

  const ps: P[] = Array.from({ length: count }, () => {
    if (kind === 'stars') {
      return { x: Math.random() * w, y: -10 - Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 2.5,
        life: 0, maxLife: 140 + Math.random() * 80, size: 3 + Math.random() * 5, hue: 40 + Math.random() * 20 }
    }
    // embers：底部向上飘
    return { x: Math.random() * w, y: h + 10,
      vx: (Math.random() - 0.5) * 0.8, vy: -(0.8 + Math.random() * 1.8),
      life: 0, maxLife: 100 + Math.random() * 60, size: 2 + Math.random() * 3, hue: 15 + Math.random() * 25 }
  })

  let raf = 0
  const tick = () => {
    ctx.clearRect(0, 0, w, h)
    let alive = false
    for (const p of ps) {
      p.life += 1
      if (p.life > p.maxLife) continue
      alive = true
      p.x += p.vx
      p.y += p.vy
      const fade = 1 - p.life / p.maxLife
      ctx.beginPath()
      ctx.fillStyle = `hsla(${p.hue}, 90%, ${kind === 'stars' ? 65 : 55}%, ${fade})`
      ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2)
      ctx.fill()
    }
    if (alive) raf = requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, w, h)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
