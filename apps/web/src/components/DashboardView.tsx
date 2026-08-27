import { useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import { loadSessions } from '../lib/storage'
import { getFamilyId, newFamilyId, pullProfile, disableSync, pushProfile, syncEnabled } from '../lib/sync'
import { loadProfileData } from '../lib/profile'
import { metricRates } from '../lib/profile'
import { metricTrend } from '../lib/profile'
import { PATTERN_LABELS, dominantAdvice } from '../lib/errorPatterns'
import { STAGES, stagesOf } from '../lib/adventure'
import { getLeaderboard, type LeaderboardEntry } from '../lib/score'
import { useEffect } from 'react'
import { getFamilyId } from '../lib/sync'

// 家长周报：LLM 基于一周画像生成，可语音朗读
function WeeklyReport() {
  const [text, setText] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')
  const ask = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/weekly-report?familyId=${encodeURIComponent(getFamilyId() ?? '')}`)
      if (res.status === 404) { setState('empty'); return }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setText(data.text)
      setState('idle')
    } catch { setState('error') }
  }
  const speak = () => {
    if (!text || !('speechSynthesis' in window)) return
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'zh-CN'; utt.rate = 0.9
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utt)
  }
  return (
    <div className="pattern-card">
      <h3 className="chart-title">📮 本周成长简报（给家长）</h3>
      {text ? (
        <>
          <p className="weekly-text">{text}</p>
          <button className="speak-btn" title="朗读简报" onClick={speak}>🔊</button>
        </>
      ) : (
        <button className="primary" onClick={ask} disabled={state === 'loading'}>
          {state === 'loading' ? '正在生成…' : state === 'error' ? '生成失败，再试一次' : state === 'empty' ? '本周还没有练习记录' : '✨ 生成本周简报'}
        </button>
      )}
    </div>
  )
}

const ALL_STAGES = [...STAGES, ...stagesOf('chinese'), ...stagesOf('english')]

interface StageStat { name: string; emoji: string; total: number; wrong: number; questions: Question[] }

// 知识点热力图：按关卡聚合正确率，薄弱点（错题多/正确率低）高亮
function Heatmap({ onRetry }: { onRetry: (qs: Question[]) => void }) {
  const stats = new Map<string, StageStat>()
  for (const s of loadSessions()) {
    const sid = s.settings.stageId
    if (!sid) continue
    const def = ALL_STAGES.find((x) => x.id === sid)
    if (!def) continue
    const cur = stats.get(sid) ?? { name: def.name, emoji: def.emoji, total: 0, wrong: 0, questions: [] }
    cur.total += s.answered
    cur.wrong += s.wrong.length
    for (const w of s.wrong) cur.questions.push(w.question)
    stats.set(sid, cur)
  }
  const rows = [...stats.values()].sort((a, b) => (b.wrong / Math.max(b.total, 1)) - (a.wrong / Math.max(a.total, 1)))
  if (rows.length === 0) return null
  return (
    <div className="pattern-card">
      <h3 className="chart-title">🗺️ 知识点热力图（按关卡）</h3>
      <div className="pattern-bars">
        {rows.map((r) => {
          const acc = r.total > 0 ? 1 - r.wrong / r.total : 1
          const hue = Math.round(acc * 120)  // 0=红 120=绿
          return (
            <div key={r.name} className="pattern-row">
              <span className="pattern-label">{r.emoji} {r.name}</span>
              <div className="pattern-bar">
                <div style={{ width: `${acc * 100}%`, background: `hsl(${hue} 65% 45%)` }} />
              </div>
              <span className="pattern-acc" style={{ color: `hsl(${hue} 65% 32%)` }}>
                {Math.round(acc * 100)}%{r.wrong > 0 ? ` · 错${r.wrong}` : ''}
              </span>
              {r.wrong > 0 && (
                <button className="retry-mini" onClick={() => onRetry(r.questions)}>
                  重练 {r.questions.length} 题
                </button>
              )}
            </div>
          )
        })}
      </div>
      {rows[0].wrong > 0 && (
        <div className="adaptive-hint weak-spot">
          🔥 最薄弱：{rows[0].emoji} {rows[0].name}（正确率 {Math.round((1 - rows[0].wrong / Math.max(rows[0].total, 1)) * 100)}%）
          <button className="primary retry-main" onClick={() => onRetry(rows[0].questions)}>
            立即重练该关错题 →
          </button>
        </div>
      )}
    </div>
  )
}

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

// 指标趋势：14 天 推荐采纳率/反哺命中率 双折线（null 天断线不画点）
function MetricTrendChart() {
  const { days, rec, hit } = metricTrend(14)
  const hasData = rec.some((v) => v !== null) || hit.some((v) => v !== null)
  if (!hasData) return null
  const W = 440
  const H = 120
  const step = (W - 16) / (days.length - 1)
  const toY = (v: number) => H - 12 - v * (H - 32)
  const series = (values: Array<number | null>, color: string) => {
    const pts = values.map((v, i) => (v === null ? null : ([8 + i * step, toY(v)] as const)))
    // 断线分段：连续非 null 段各自成 polyline
    const segs: string[] = []
    let cur: string[] = []
    pts.forEach((p) => {
      if (p) cur.push(`${p[0]},${p[1]}`)
      else if (cur.length > 1) { segs.push(cur.join(' ')); cur = [] } else { cur = [] }
    })
    if (cur.length > 1) segs.push(cur.join(' '))
    return (
      <g>
        {segs.map((s, i) => <polyline key={i} points={s} fill="none" stroke={color} strokeWidth="2.5" />)}
        {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={color} />)}
      </g>
    )
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        <line x1="8" y1={toY(1)} x2={W - 8} y2={toY(1)} stroke="#d7e4f5" strokeDasharray="4" />
        <line x1="8" y1={toY(0.5)} x2={W - 8} y2={toY(0.5)} stroke="#eef2f7" strokeDasharray="4" />
        <line x1="8" y1={toY(0)} x2={W - 8} y2={toY(0)} stroke="#d7e4f5" />
        {series(rec, '#4a90e2')}
        {series(hit, '#e2904a')}
      </svg>
      <div className="chart-range">
        <span>{days[0]}</span>
        <span><i className="legend" style={{ background: '#4a90e2' }} /> 推荐采纳率 <i className="legend" style={{ background: '#e2904a' }} /> 反哺命中率</span>
        <span>{days[days.length - 1]}</span>
      </div>
    </div>
  )
}

export default function DashboardView({ onRetryMistakes }: { onRetryMistakes: (qs: Question[]) => void }) {
  const [sync, setSync] = useState(syncEnabled())
  const [board, setBoard] = useState<{ entries: LeaderboardEntry[]; myRank: number | null } | null>(null)

  useEffect(() => {
    if (sync) getLeaderboard().then(setBoard)
  }, [sync])
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
        const { recRate, hitRate } = metricRates()
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
            {(recRate !== null || hitRate !== null) && (
              <p className="metric-line">
                {recRate !== null && `🧭 推荐采纳率 ${Math.round(recRate * 100)}%（${pd.metrics!.recAdopted}/${pd.metrics!.recShown}）`}
                {recRate !== null && hitRate !== null && ' · '}
                {hitRate !== null && `🎯 反哺命中率 ${Math.round(hitRate * 100)}%（${pd.metrics!.adaptHit}/${pd.metrics!.adaptShown}）`}
              </p>
            )}
            <MetricTrendChart />
          </div>
        )
      })()}

      <Heatmap onRetry={onRetryMistakes} />

      {sync && <WeeklyReport />}

      {sync && board && board.entries.length > 0 && (
        <div className="pattern-card">
          <h3 className="chart-title">🏆 全服排行榜{board.myRank ? `（我的排名 #${board.myRank}）` : ''}</h3>
          <div className="leaderboard">
            {board.entries.map((e) => (
              <div key={e.rank} className={`lb-row${board.myRank === e.rank ? ' me' : ''}`}>
                <span className="lb-rank">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}</span>
                <span className="lb-name">{e.nicknameMasked}</span>
                <span className="lb-pts">{e.totalPoints} 分</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
