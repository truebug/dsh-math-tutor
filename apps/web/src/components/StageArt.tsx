// 程序化分层场景（SVG 剪影 + 渐变）：kage 式「前景剪影层」的零资源实现
// 每关一组配色与剪影元素，可作为生成静帧的占位/底色

const THEMES: Record<string, { sky: [string, string]; hills: string; emoji: string }> = {
  forest: { sky: ['#1d4a3a', '#7fb069'], hills: '#123026', emoji: '🌲' },
  cave:   { sky: ['#2b2d42', '#5c6784'], hills: '#1a1b2e', emoji: '🕳️' },
  lake:   { sky: ['#1a5f7a', '#57c5b6'], hills: '#0f3d52', emoji: '💧' },
  snow:   { sky: ['#4a6fa5', '#b8c6db'], hills: '#33507a', emoji: '🏔️' },
  island: { sky: ['#f2994a', '#f2c94c'], hills: '#b87424', emoji: '🏝️' },
  vine:    { sky: ['#2d6a4f', '#95d5b2'], hills: '#1b4332', emoji: '🌿' },
  bamboo:  { sky: ['#606c38', '#ccd5ae'], hills: '#3a4623', emoji: '🎋' },
  falls:   { sky: ['#168aad', '#99e2b4'], hills: '#0e5a75', emoji: '🌊' },
  thunder: { sky: ['#3d348b', '#7678ed'], hills: '#26215c', emoji: '⛰️' },
  temple:  { sky: ['#9a7b0a', '#f7d354'], hills: '#6e5705', emoji: '🏆' },
}

export default function StageArt({ stageId, height = 90 }: { stageId: string; height?: number }) {
  const t = THEMES[stageId] ?? THEMES.forest
  return (
    <svg viewBox="0 0 400 90" preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height, display: 'block', borderRadius: 12 }} aria-hidden>
      <defs>
        <linearGradient id={`sky-${stageId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.sky[0]} />
          <stop offset="1" stopColor={t.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="90" fill={`url(#sky-${stageId})`} />
      {/* 远景山/地形剪影 */}
      <path d="M0 60 L60 30 L120 55 L200 25 L280 58 L340 38 L400 62 L400 90 L0 90 Z"
        fill={t.hills} opacity="0.55" />
      {/* 前景剪影层（更深色、更锐利） */}
      <path d="M0 75 L80 52 L160 72 L240 50 L320 74 L400 58 L400 90 L0 90 Z"
        fill={t.hills} />
      <text x="200" y="46" textAnchor="middle" fontSize="34">{t.emoji}</text>
    </svg>
  )
}
