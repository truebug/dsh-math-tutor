// 古诗词接龙：给出上句，从 4 个选项中接出下一句
import { useMemo, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import { poemChainRounds } from '../lib/arcade'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

export default function PoemChainView({ settings, onAbandon, onFinish }: Props) {
  const { rounds, questions } = useMemo(
    () => poemChainRounds(settings.seed, settings.count),
    [settings.seed, settings.count],
  )
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const startRef = useRef(Date.now())
  const qBornRef = useRef(Date.now())
  const answersRef = useRef<Array<string | null>>(rounds.map(() => null))
  const msRef = useRef<number[]>(rounds.map(() => 0))
  const doneRef = useRef(false)

  const finish = (by: 'submit' | 'timeout') => {
    if (doneRef.current) return
    doneRef.current = true
    onFinish({ answers: answersRef.current, perQuestionMs: msRef.current, usedMs: Date.now() - startRef.current, finishedBy: by, questions })
  }

  const choose = (opt: string) => {
    if (picked || doneRef.current) return
    setPicked(opt)
    const round = rounds[idx]
    const ok = opt === round.next
    answersRef.current[idx] = opt
    msRef.current[idx] = Date.now() - qBornRef.current
    setStreak(ok ? streak + 1 : 0)
    setTimeout(() => {
      if (idx + 1 >= rounds.length) finish('submit')
      else { setIdx(idx + 1); setPicked(null); qBornRef.current = Date.now() }
    }, ok ? 500 : 900)
  }

  const round = rounds[idx]
  return (
    <div className="race game-shell">
      <header className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <b>📜 古诗词接龙</b>
        <span className="game-progress">{idx + 1} / {rounds.length}{streak >= 2 ? ` 🔥${streak}` : ''}</span>
      </header>
      <div className="chain-stage">
        <p className="chain-poem">{round.poemTitle}</p>
        <p className="chain-prev">{round.prev}</p>
        <p className="chain-hint">下一句是？</p>
        <div className="chain-options">
          {round.options.map((opt) => (
            <button
              key={opt}
              className={`chain-opt${picked === opt ? (opt === round.next ? ' ok' : ' no') : ''}${picked && opt === round.next ? ' ok' : ''}`}
              disabled={!!picked}
              onClick={() => choose(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
