import { loadMistakes } from '../lib/storage'

export default function MistakeBook({ onBack }: { onBack: () => void }) {
  const mistakes = loadMistakes()
  return (
    <div className="card">
      <h1>📒 错题本</h1>
      {mistakes.length === 0 ? (
        <p className="subtitle">太棒了，目前还没有错题记录！</p>
      ) : (
        <div className="wrong-list">
          {mistakes.map((m, i) => (
            <div key={i} className="wrong-item">
              <span>{m.question.text}</span>
              <span className="right">正确：{m.question.answer}</span>
              <span className="given">错 {m.times} 次 · 最近 {m.lastDate.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
      <button className="ghost" onClick={onBack}>返回</button>
    </div>
  )
}
