import { useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import { loadSessions, loadProfile } from '../lib/storage'
import { getFamilyId, newFamilyId, pullProfile, disableSync, pushProfile, syncEnabled, claimNickname, nicknameHasPin, resolveNickname, setNicknamePin } from '../lib/sync'
import { loadProfileData } from '../lib/profile'
import { metricRates } from '../lib/profile'
import { metricTrend } from '../lib/profile'
import { badgeWall } from '../lib/badges'
import { PATTERN_LABELS, dominantAdvice } from '../lib/errorPatterns'
import { STAGES, stagesOf } from '../lib/adventure'
import { getLeaderboard, type LeaderboardEntry } from '../lib/score'
import { useEffect } from 'react'
import GrowthReport from './GrowthReport'

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
  // 昵称绑定冲突态：null=无冲突；{nick, hasPin}=昵称已被占用，等用户选择
  const [nickConflict, setNickConflict] = useState<{ nick: string; hasPin: boolean } | null>(null)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')

  const enable = async () => {
    const id = newFamilyId()
    setSync(true)
    pushProfile()
    // 昵称绑定：同昵称已绑 → 弹冲突选择；否则直接登记
    const nick = loadProfile()?.nickname ?? ''
    if (nick) {
      const r = await claimNickname(nick, id)
      if (r === 'conflict') {
        setNickConflict({ nick, hasPin: (await nicknameHasPin(nick)) ?? false })
        setMsg(`已开启。昵称「${nick}」已被绑定，请确认是否为本人换设备`)
        return
      }
    }
    setMsg(`已开启。家庭ID：${id}（也可用昵称「${nick}」在其他设备恢复）`)
  }
  // 冲突处理 A：我是本人（换设备）→ 解析昵称（可能要 PIN）→ 拉取云端数据
  const claimAsSelf = async () => {
    if (!nickConflict) return
    const fid = await resolveNickname(nickConflict.nick, pin || undefined)
    if (!fid) { setMsg(nickConflict.hasPin ? 'PIN 不对，请重试' : '解析失败，请重试'); return }
    const ok = await pullProfile(fid)
    setMsg(ok ? '已恢复云端数据，刷新页面生效' : '找到了绑定但拉取数据失败')
    setNickConflict(null)
  }
  // 冲突处理 B：我是重名新人 → 保留新 ID，昵称加后缀再登记
  const claimAsNew = async () => {
    if (!nickConflict) return
    const fid = getFamilyId()!
    await claimNickname(`${nickConflict.nick}-2`, fid)
    setMsg(`已作为新用户登记（昵称显示为「${nickConflict.nick}-2」），数据互不影响`)
    setNickConflict(null)
  }
  // 可选 PIN：设置后换设备需输码
  const savePin = async () => {
    const nick = loadProfile()?.nickname ?? ''
    const fid = getFamilyId()
    if (!nick || !fid) return
    const r = await setNicknamePin(nick, fid, newPin)
    setMsg(r === 'ok' ? (newPin ? 'PIN 已设置，换设备恢复时需输入' : 'PIN 已清除') : r === 'bad' ? 'PIN 需为 4-6 位数字' : '设置失败，请重试')
    setNewPin('')
  }
  const restore = async () => {
    // 支持两种输入：f- 开头按家庭ID恢复；否则按昵称解析（可能要求 PIN）
    let fid = restoreId.trim()
    if (!fid.startsWith('f-')) {
      const hasPin = await nicknameHasPin(fid)
      const p = hasPin ? (window.prompt('该昵称设有 PIN，请输入 4-6 位数字：') ?? '') : undefined
      fid = (await resolveNickname(fid, p)) ?? ''
    }
    const ok = fid ? await pullProfile(fid) : false
    setMsg(ok ? '已从云端恢复，刷新页面生效' : '未找到该 ID/昵称（或 PIN 不对）')
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

      {/* 勋章墙：已获得点亮 + 未获得灰色带进度提示 */}
      {(() => {
        const { earned, pending } = badgeWall()
        return (
          <div className="pattern-card">
            <h3 className="chart-title">🎖️ 勋章墙（{earned.length}/{earned.length + pending.length}）</h3>
            <div className="badge-wall">
              {earned.map((b) => (
                <div key={b.id} className="badge-cell earned" title={b.desc}>
                  <span className="badge-emoji">{b.emoji}</span>
                  <small>{b.name}</small>
                </div>
              ))}
              {pending.map(({ badge: b, hint }) => (
                <div key={b.id} className="badge-cell" title={b.desc}>
                  <span className="badge-emoji dim">{b.emoji}</span>
                  <small>{b.name}{hint ? ` ${hint}` : ''}</small>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {sync && <GrowthReport />}

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
            {/* 昵称冲突选择：同昵称已被绑定时的两条路 */}
            {nickConflict && (
              <div className="nick-conflict">
                <b>昵称「{nickConflict.nick}」已被使用</b>
                <p>如果这个昵称是你（换设备/换浏览器），请选择恢复；如果是重名的另一位小朋友，请选择新开档案。</p>
                {nickConflict.hasPin && (
                  <input placeholder="该昵称设有 PIN，请输入" value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={6} />
                )}
                <div className="btn-row">
                  <button className="primary" onClick={claimAsSelf}>是我本人，恢复数据</button>
                  <button className="ghost" onClick={claimAsNew}>重名新人，新开档案</button>
                </div>
              </div>
            )}
            {/* 可选 PIN：给昵称加把锁（换设备恢复时需输入） */}
            <div className="code-row">
              <input placeholder="可选：设置恢复 PIN（4-6位数字）" value={newPin} onChange={(e) => setNewPin(e.target.value)} inputMode="numeric" maxLength={6} />
              <button className="ghost" onClick={savePin}>{newPin ? '设置' : '清除'} PIN</button>
            </div>
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
