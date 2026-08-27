// 每周成长报告（可打印）：大数字周环比 + 7天柱状图 + 分科对比表 + 亮点/重点 + AI寄语
// 数据全部来自本地 sessions 确定性计算；打印时 @media print 只输出本卡片（适 A4）
import { useState } from 'react'
import { loadSessions, loadProfile } from '../lib/storage'
import type { SessionRecord } from '../lib/types'
import { STAGES, stagesOf } from '../lib/adventure'
import { getFamilyId } from '../lib/sync'

const ALL_STAGES = [...STAGES, ...stagesOf('chinese'), ...stagesOf('english')]
const SUBJECT_LABEL: Record<string, string> = { math: '数学', chinese: '语文', english: '英语' }
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

interface Bucket { sessions: number; total: number; correct: number; usedMs: number }

function bucketOf(sessions: SessionRecord[], from: number, to: number): Bucket {
  const b: Bucket = { sessions: 0, total: 0, correct: 0, usedMs: 0 }
  for (const s of sessions) {
    const t = new Date(s.date).getTime()
    if (t >= from && t < to) {
      b.sessions += 1; b.total += s.total; b.correct += s.correct; b.usedMs += s.usedMs
    }
  }
  return b
}

function acc(b: Bucket): number { return b.total > 0 ? b.correct / b.total : 0 }

// 周环比三角：↑ 绿 / ↓ 红 / → 灰（练习量类指标升降都中性展示）
function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (prev === 0 && cur === 0) return null
  const up = cur > prev
  const good = invert ? !up : up
  const cls = cur === prev ? 'flat' : good ? 'up' : 'down'
  const glyph = cur === prev ? '→' : up ? '↑' : '↓'
  return <span className={`delta ${cls}`}>{glyph}</span>
}

function speakText(text: string) {
  if (!('speechSynthesis' in window)) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'zh-CN'; utt.rate = 0.9
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(utt)
}

export default function GrowthReport() {
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')

  const now = Date.now()
  const W = 7 * 86400000
  const sessions = loadSessions()
  const cur = bucketOf(sessions, now - W, now)
  const prev = bucketOf(sessions, now - 2 * W, now - W)

  // 7 天柱状图：每天题目数（柱）+ 正确率（点）
  const days: Array<{ label: string; total: number; acc: number }> = []
  for (let i = 6; i >= 0; i -= 1) {
    const from = now - (i + 1) * 86400000
    const b = bucketOf(sessions, from, from + 86400000)
    days.push({ label: DAY_LABELS[new Date(from).getDay()], total: b.total, acc: acc(b) })
  }
  const maxTotal = Math.max(...days.map((d) => d.total), 1)

  // 分科对比
  const subjects = (['math', 'chinese', 'english'] as const).map((sub) => {
    const c = bucketOf(sessions.filter((s) => (s.settings.subject ?? 'math') === sub), now - W, now)
    const p = bucketOf(sessions.filter((s) => (s.settings.subject ?? 'math') === sub), now - 2 * W, now - W)
    return { sub, cur: c, prev: p }
  }).filter((s) => s.cur.sessions > 0 || s.prev.sessions > 0)

  // 亮点与重点
  const weekSessions = sessions.filter((s) => new Date(s.date).getTime() >= now - W)
  const best = [...weekSessions].sort((a, b) => b.correct - a.correct)[0]
  const perfect = weekSessions.filter((s) => s.total > 0 && s.correct === s.total).length
  const stageStats = new Map<string, { name: string; emoji: string; total: number; wrong: number }>()
  for (const s of weekSessions) {
    const sid = s.settings.stageId
    if (!sid) continue
    const def = ALL_STAGES.find((x) => x.id === sid)
    if (!def) continue
    const e = stageStats.get(sid) ?? { name: def.name, emoji: def.emoji, total: 0, wrong: 0 }
    e.total += s.answered; e.wrong += s.wrong.length
    stageStats.set(sid, e)
  }
  const weakest = [...stageStats.values()].filter((s) => s.total >= 5).sort((a, b) => a.wrong / a.total - b.wrong / b.total).pop()

  const weekStart = new Date(now - W).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  const weekEnd = new Date(now).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  const nickname = loadProfile()?.nickname ?? '小朋友'

  const askAi = async () => {
    setAiState('loading')
    try {
      const res = await fetch(`/api/weekly-report?familyId=${encodeURIComponent(getFamilyId() ?? '')}`)
      if (res.status === 404) { setAiState('empty'); return }
      if (!res.ok) throw new Error()
      setAiText(((await res.json()) as { text?: string }).text ?? null)
      setAiState('idle')
    } catch { setAiState('error') }
  }

  if (cur.sessions === 0 && prev.sessions === 0) return null

  return (
    <div className="pattern-card growth-report">
      {/* 报告头：标题 + 周期 + 打印按钮（打印时按钮隐藏） */}
      <div className="gr-head">
        <div>
          <h3 className="chart-title">📋 每周成长报告</h3>
          <p className="gr-period">{nickname} · {weekStart} — {weekEnd}</p>
        </div>
        <button className="ghost no-print" onClick={() => window.print()}>🖨️ 打印</button>
      </div>

      {/* 关键数字：大字号 + 周环比 */}
      <div className="gr-stats">
        <div className="gr-stat">
          <b>{cur.sessions}</b><span>练习次数 <Delta cur={cur.sessions} prev={prev.sessions} /></span>
        </div>
        <div className="gr-stat">
          <b>{cur.total}</b><span>完成题目 <Delta cur={cur.total} prev={prev.total} /></span>
        </div>
        <div className="gr-stat">
          <b>{Math.round(acc(cur) * 100)}%</b><span>正确率 <Delta cur={acc(cur)} prev={acc(prev)} /></span>
        </div>
        <div className="gr-stat">
          <b>{Math.round(cur.usedMs / 60000)}<small>分</small></b><span>学习时长 <Delta cur={cur.usedMs} prev={prev.usedMs} /></span>
        </div>
      </div>

      {/* 7 天柱状图 */}
      <div className="gr-chart">
        <h4>每日练习量（柱=题数 · 点=正确率）</h4>
        <div className="gr-bars">
          {days.map((d, i) => (
            <div key={i} className="gr-bar-col">
              <div className="gr-bar-area">
                {d.total > 0 && (
                  <span className="gr-dot" style={{ bottom: `${d.acc * 100}%` }} title={`正确率 ${Math.round(d.acc * 100)}%`} />
                )}
                <div className="gr-bar" style={{ height: `${(d.total / maxTotal) * 100}%` }} />
              </div>
              <span className="gr-bar-num">{d.total > 0 ? d.total : ''}</span>
              <span className="gr-bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 分科对比表 */}
      {subjects.length > 0 && (
        <table className="gr-table">
          <thead>
            <tr><th>科目</th><th>本周题数</th><th>正确率</th><th>上周正确率</th><th>变化</th></tr>
          </thead>
          <tbody>
            {subjects.map(({ sub, cur: c, prev: p }) => (
              <tr key={sub}>
                <td>{SUBJECT_LABEL[sub]}</td>
                <td>{c.total}</td>
                <td>{c.total > 0 ? `${Math.round(acc(c) * 100)}%` : '—'}</td>
                <td>{p.total > 0 ? `${Math.round(acc(p) * 100)}%` : '—'}</td>
                <td><Delta cur={acc(c)} prev={acc(p)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 亮点 + 重点关注 */}
      <div className="gr-highlights">
        {best && (
          <p>🌟 <b>最佳一次：</b>{new Date(best.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 答对 {best.correct}/{best.total} 题（{Math.round(best.accuracy * 100)}%）</p>
        )}
        {perfect > 0 && <p>💯 <b>满分 {perfect} 次</b>，基本功越来越扎实</p>}
        {weakest && weakest.wrong > 0 && (
          <p className="gr-weak">🎯 <b>重点关注：</b>{weakest.emoji} {weakest.name} 正确率 {Math.round((1 - weakest.wrong / weakest.total) * 100)}%，建议本周再练 2 次</p>
        )}
      </div>

      {/* AI 寄语（LLM 生成，打印也带上） */}
      <div className="gr-ai">
        {aiText ? (
          <>
            <h4>✨ 老师寄语</h4>
            <p>{aiText}</p>
            <button className="speak-btn no-print" title="朗读寄语" onClick={() => speakText(aiText)}>🔊</button>
          </>
        ) : (
          <button className="primary no-print" onClick={askAi} disabled={aiState === 'loading'}>
            {aiState === 'loading' ? '正在生成…' : aiState === 'error' ? '生成失败，再试一次' : aiState === 'empty' ? '本周还没有练习记录' : '✨ 生成老师寄语'}
          </button>
        )}
      </div>
    </div>
  )
}
