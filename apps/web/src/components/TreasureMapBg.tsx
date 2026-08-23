// 古典海盗藏宝图背景：优先使用生成的静帧（public/treasure-map.webp），
// 不存在时回退到程序化 SVG（羊皮纸 + 罗盘玫瑰 + 虚线航线 + 海怪波纹），零资源保底。
import { useEffect, useState } from 'react'

const STATIC_URL = `${import.meta.env.BASE_URL}treasure-map.webp`

export default function TreasureMapBg() {
  const [useImage, setUseImage] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setUseImage(true)
    img.src = STATIC_URL
  }, [])

  if (useImage) {
    return <div className="treasure-bg" style={{ backgroundImage: `url(${STATIC_URL})` }} aria-hidden />
  }

  return (
    <svg className="treasure-bg" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="parchment" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8d5a8" />
          <stop offset="0.5" stopColor="#dfc48f" />
          <stop offset="1" stopColor="#cbb078" />
        </linearGradient>
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.06 0" />
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
        <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#00000000" />
          <stop offset="1" stopColor="#5a3a10" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      <rect width="800" height="500" fill="url(#parchment)" filter="url(#paper)" />
      <rect width="800" height="500" fill="url(#vignette)" />

      {/* 内框虚线 */}
      <rect x="18" y="18" width="764" height="464" fill="none" stroke="#7a5a28" strokeWidth="2" strokeDasharray="10 6" opacity="0.5" />

      {/* 罗盘玫瑰 */}
      <g transform="translate(655,110)" stroke="#6b4a1a" fill="none" opacity="0.75">
        <circle r="46" strokeWidth="2" />
        <circle r="34" strokeWidth="1" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <polygon key={deg} points="0,-44 6,-8 0,-14 -6,-8" fill="#6b4a1a" stroke="none"
            transform={`rotate(${deg})`} opacity={deg % 90 === 0 ? 1 : 0.5} />
        ))}
        <text y="-52" textAnchor="middle" fontSize="16" fill="#6b4a1a" stroke="none" fontFamily="serif">N</text>
      </g>

      {/* 虚线航线 + X 标记 */}
      <path d="M90 400 Q 200 320 290 360 T 480 300 T 640 380" fill="none"
        stroke="#8a3a1a" strokeWidth="3" strokeDasharray="12 10" opacity="0.65" />
      <g stroke="#8a3a1a" strokeWidth="5" strokeLinecap="round" opacity="0.8">
        <line x1="628" y1="366" x2="652" y2="394" />
        <line x1="652" y1="366" x2="628" y2="394" />
      </g>
      <g stroke="#8a3a1a" strokeWidth="4" strokeLinecap="round" opacity="0.5">
        <line x1="80" y1="388" x2="100" y2="412" />
        <line x1="100" y1="388" x2="80" y2="412" />
      </g>

      {/* 海怪与波纹 */}
      <g transform="translate(150,120)" stroke="#6b4a1a" fill="none" strokeWidth="2.5" opacity="0.55">
        <path d="M0 20 Q 15 -10 30 20 T 60 20" />
        <path d="M8 22 Q 15 34 26 24" />
        <circle cx="12" cy="8" r="2" fill="#6b4a1a" />
      </g>
      {[420, 460].map((y, i) => (
        <path key={i} d={`M40 ${y} q 15 -8 30 0 t 30 0 t 30 0`} stroke="#6b4a1a"
          fill="none" strokeWidth="2" opacity="0.35" />
      ))}
      <text x="60" y="60" fontFamily="serif" fontSize="20" fill="#6b4a1a" opacity="0.6" fontStyle="italic">
        ☠ Ye Olde Treasure Map ☠
      </text>
    </svg>
  )
}
