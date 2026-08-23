import { loadMistakes } from '../lib/storage'
import { generateSimilar, mulberry32, type Question } from '@dsh-math-tutor/math-generator/core'

interface Props {
  onBack: () => void
  onRetryMistakes: (questions: Question[]) => void
}

export default function MistakeBook({ onBack, onRetryMistakes }: Props) {
  const mistakes = loadMistakes()

  const retry = () => {
    // 取最近错误最多的前 20 道，生成同题型、同进退位性质的新数字题
    const rng = mulberry32(Date.now())
    const questions = mistakes.slice(0, 20).map((m, i) => generateSimilar(m.question, rng, i))
    onRetryMistakes(questions)
  }

  return (
    <div className="card">
      <h1>📒 错题本</h1>
      {mistakes.length === 0 ? (
        <p className="subtitle">太棒了，目前还没有错题记录！</p>
      ) : (
        <>
          <button className="primary" onClick={retry}>
            🔄 重练错题（同题型新数字，共 {Math.min(mistakes.length, 20)} 题）
          </button>
          <div className="wrong-list">
            {mistakes.map((m, i) => (
              <div key={i} className="wrong-item">
                <span>{m.question.text}</span>
                <span className="right">正确：{m.question.answerText ?? m.question.answer}</span>
                <span className="given">错 {m.times} 次 · 最近 {m.lastDate.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <button className="ghost" onClick={onBack}>返回</button>
    </div>
  )
}
