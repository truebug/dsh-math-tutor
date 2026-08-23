import { loadSessions } from '../lib/storage'

function LineChart({ values, format, color }: { values: number[]; format: (v: number) => string; color: string }) {
  if (values.length === 0) return <p className="subtitle">还没有数据</p>
  const W = 440
  const H = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 16) + 8
    const y = H - 12 - ((v - min) / span) * (H - 32)
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill={color} />)}
      </svg>
      <div className="chart-range">
        <span>最早：{format(values[0])}</span>
        <span>最近：{format(values[values.length - 1])}</span>
      </div>
    </div>
  )
}

export default function DashboardView() {
  const sessions = loadSessions()
  const recent = [...sessions].reverse().slice(-20)  // 时间正序，最多 20 次
  const totalQ = sessions.reduce((n, s) => n + s.total, 0)
  const totalCorrect = sessions.reduce((n, s) => n + s.correct, 0)
  const overallAcc = totalQ > 0 ? totalCorrect / totalQ : 0
  const avgSpeed = sessions.length > 0
    ? sessions.reduce((n, s) => n + s.usedMs / Math.max(s.answered, 1), 0) / sessions.length / 1000
    : 0

  return (
    <div className="card wide">
      <h1>📊 成长看板</h1>
      <div className="stats">
        <div className="stat"><b>{sessions.length}</b><span>练习次数</span></div>
        <div className="stat"><b>{totalQ}</b><span>累计题目</span></div>
        <div className="stat"><b>{Math.round(overallAcc * 100)}%</b><span>总正确率</span></div>
        <div className="stat"><b>{avgSpeed.toFixed(1)}s</b><span>平均每题</span></div>
      </div>

      <h3 className="chart-title">正确率趋势（最近 {recent.length} 次）</h3>
      <LineChart
        values={recent.map((s) => Math.round(s.accuracy * 100))}
        format={(v) => `${v}%`}
        color="#4a90e2"
      />

      <h3 className="chart-title">速度趋势（平均每题秒数，越低越快）</h3>
      <LineChart
        values={recent.map((s) => Math.round(s.usedMs / Math.max(s.answered, 1) / 100) / 10)}
        format={(v) => `${v}s`}
        color="#e2a44a"
      />

      <p className="privacy">数据保存在本机浏览器，未上传。历史记录（旧到新）：{recent.map((s) => s.date.slice(5, 10)).join(' · ')}</p>
    </div>
  )
}
