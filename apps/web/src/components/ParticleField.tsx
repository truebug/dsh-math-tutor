// 首屏 Hero 轻量粒子网络背景（Canvas 2D 自绘，零依赖；reduced-motion 降级为静态帧）
import { useEffect, useRef } from 'react'

interface P { x: number; y: number; vx: number; vy: number; r: number }

export default function ParticleField({ count = 42, maxDist = 110 }: { count?: number; maxDist?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0, raf = 0
    const dpr = Math.min(devicePixelRatio || 1, 2)
    let ps: P[] = []

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ps = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        r: 1.2 + Math.random() * 2.2,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      // 连线
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y
          const d = Math.hypot(dx, dy)
          if (d < maxDist) {
            ctx.strokeStyle = `rgba(255, 215, 138, ${(1 - d / maxDist) * 0.28})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke()
          }
        }
      }
      // 星点（藏宝图星光：暖金色）
      for (const p of ps) {
        ctx.fillStyle = 'rgba(255, 226, 160, 0.75)'
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      }
    }

    const tick = () => {
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy
        if (p.x < -8) p.x = w + 8; if (p.x > w + 8) p.x = -8
        if (p.y < -8) p.y = h + 8; if (p.y > h + 8) p.y = -8
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    if (reduced) draw()   // 降级：只画一帧静态星图
    else raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [count, maxDist])

  return <canvas ref={ref} className="particle-field" aria-hidden />
}
