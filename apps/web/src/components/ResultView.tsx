import { encodeRaceCode } from '../lib/raceCode'
import type { RaceSettings, SessionRecord } from '../lib/types'

interface Props {
  record: SessionRecord
  onRetry: (settings: RaceSettings) => void
  onHome: () => void
  onOpenMistakes: () => void
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}分${s % 60}秒`
}

export default function ResultView({ record, onRetry, onHome, onOpenMistakes }: Props) {
  const { settings } = record
  const avg = record.answered > 0 ? Math.round(record.usedMs / record.answered / 100) / 10 : 0
  const praise =
    record.accuracy === 1 ? '满分！太厉害了 🏆' :
    record.accuracy >= 0.9 ? '非常棒，差一点点满分 🌟' :
    record.accuracy >= 0.7 ? '不错，继续加油 💪' : '别灰心，错题本里练一练 📒'

  return (
    <div className="card">
      <h1>📊 成绩报告</h1>
      <p className="praise">{praise}</p>

      <div className="stats">
        <div className="stat"><b>{record.correct}</b><span>答对 / {record.total} 题</span></div>
        <div className="stat"><b>{Math.round(record.accuracy * 100)}%</b><span>正确率</span></div>
        <div className="stat"><b>{fmt(record.usedMs)}</b><span>{record.finishedBy === 'timeout' ? '时间到' : '用时'}</span></div>
        <div className="stat"><b>{avg}s</b><span>平均每题</span></div>
      </div>

      {record.wrong.length > 0 && (
        <div className="wrong-list">
          <h3>本次错题（{record.wrong.length}）</h3>
          {record.wrong.map((w, i) => (
            <div key={i} className="wrong-item">
              <span>{w.question.text}</span>
              <span className="given">你的答案：{w.given ?? '未作答'}</span>
              <span className="right">正确：{w.question.answer}</span>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="primary" onClick={() => onRetry({ ...settings, seed: Math.floor(Math.random() * 1e9) })}>
          再来一组 🔁
        </button>
        <button className="ghost" onClick={onOpenMistakes}>错题本 📒</button>
        <button className="ghost" onClick={onHome}>返回首页</button>
      </div>

      <p className="race-code-line">
        本次竞赛码：<code>{encodeRaceCode(settings)}</code>
        <button className="ghost" onClick={() => navigator.clipboard?.writeText(encodeRaceCode(settings))}>复制</button>
      </p>
    </div>
  )
}
