import { useState } from 'react'
import { loadSessions } from '../lib/storage'
import { getFamilyId, newFamilyId, pullProfile, disableSync, pushProfile, syncEnabled } from '../lib/sync'
import { loadProfileData } from '../lib/profile'
import { PATTERN_LABELS, dominantAdvice } from '../lib/errorPatterns'

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
  const [sync, setSync] = useState(syncEnabled())
  const [consent, setConsent] = useState(false)
  const [restoreId, setRestoreId] = useState('')
  const [msg, setMsg] = useState('')

  const enable = () => {
    const id = newFamilyId()
    setSync(true)
    pushProfile()
    setMsg(`已开启。家庭ID：${id}（凭此 ID 可在其他设备恢复）`)
  }
  const restore = async () => {
    const ok = await pullProfile(restoreId)
    setMsg(ok ? '已从云端恢复，刷新页面生效' : '未找到该家庭ID的数据')
    if (ok) setSync(true)
  }
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

      {(() => {
        const pd = loadProfileData()
        const total = pd.patterns.sign + pd.patterns.carry + pd.patterns.calc
        if (total === 0) return null
        const advice = dominantAdvice(pd.patterns)
        return (
          <div className="pattern-card">
            <h3 className="chart-title">错因分析（累计 {total} 次错题）</h3>
            <div className="pattern-bars">
              {(Object.entries(pd.patterns) as Array<[keyof typeof pd.patterns, number]>).map(([k, n]) => (
                <div key={k} className="pattern-row">
                  <span className="pattern-label">{PATTERN_LABELS[k]}</span>
                  <div className="pattern-bar"><div style={{ width: `${(n / total) * 100}%` }} /></div>
                  <span>{n} 次</span>
                </div>
              ))}
            </div>
            {advice && <p className="adaptive-hint">💡 {advice}</p>}
          </div>
        )
      })()}

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

      <div className="sync-card">
        <h3 className="chart-title">☁️ 云端同步（家长设置）</h3>
        {sync ? (
          <>
            <p className="adv-sub">已开启 · 家庭ID：<code>{getFamilyId()}</code> · 换设备输入此 ID 即可恢复</p>
            <button className="ghost" onClick={() => { disableSync(); setSync(false); setMsg('已停止同步，数据保留在本机') }}>停止同步</button>
          </>
        ) : (
          <>
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>我是孩子的监护人，同意将练习数据（昵称、成绩、错题、画像统计）上传到本服务器存储，用于跨设备同步与个性化学习。数据不会提供给第三方，可随时停止同步。</span>
            </label>
            <div className="btn-row">
              <button className="primary" disabled={!consent} onClick={enable}>开启云端同步</button>
            </div>
            <div className="code-row">
              <input placeholder="已有家庭ID？输入以恢复" value={restoreId} onChange={(e) => setRestoreId(e.target.value)} />
              <button className="ghost" onClick={restore} disabled={!restoreId.trim()}>恢复</button>
            </div>
          </>
        )}
        {msg && <p className="adaptive-hint">{msg}</p>}
      </div>

      <p className="privacy">{sync ? '数据已同步至服务器（监护人已同意）。' : '数据保存在本机浏览器，未上传。'}</p>
    </div>
  )
}
