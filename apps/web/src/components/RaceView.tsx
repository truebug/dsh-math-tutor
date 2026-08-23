import { useEffect, useMemo, useRef, useState } from 'react'
import { generateQuestions, normalizeAnswer, type Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'

interface Props {
  settings: RaceSettings
  onFinish: (result: {
    answers: Array<number | null>
    perQuestionMs: number[]
    usedMs: number
    finishedBy: 'submit' | 'timeout'
    questions: Question[]
  }) => void
}

export default function RaceView({ settings, onFinish }: Props) {
  const questions = useMemo(
    () => settings.customQuestions
      ?? generateQuestions({ count: settings.count, max: settings.max, ops: settings.ops, seed: settings.seed, level: settings.level }),
    [settings],
  )
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const answersRef = useRef<Array<number | null>>(Array(questions.length).fill(null))
  const perQuestionRef = useRef<number[]>([])
  const questionStartRef = useRef(Date.now())
  const startRef = useRef(Date.now())
  const [remain, setRemain] = useState(settings.durationSec)
  const inputRef = useRef<HTMLInputElement>(null)
  const finishedRef = useRef(false)

  const finish = (by: 'submit' | 'timeout') => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish({
      answers: answersRef.current,
      perQuestionMs: perQuestionRef.current,
      usedMs: Date.now() - startRef.current,
      finishedBy: by,
      questions,
    })
  }

  useEffect(() => {
    const t = setInterval(() => {
      const left = settings.durationSec - Math.floor((Date.now() - startRef.current) / 1000)
      setRemain(Math.max(left, 0))
      if (left <= 0) finish('timeout')
    }, 250)
    return () => clearInterval(t)
  }, [settings.durationSec])

  useEffect(() => {
    inputRef.current?.focus()
  }, [idx])

  const submit = () => {
    const value = normalizeAnswer(input)
    if (value === null) return
    answersRef.current[idx] = value
    perQuestionRef.current[idx] = Date.now() - questionStartRef.current
    if (idx + 1 >= questions.length) {
      finish('submit')
    } else {
      setIdx(idx + 1)
      setInput('')
      questionStartRef.current = Date.now()
    }
  }

  const q = questions[idx]
  const mm = String(Math.floor(remain / 60)).padStart(2, '0')
  const ss = String(remain % 60).padStart(2, '0')
  const urgent = remain <= 30

  return (
    <div className="card race">
      <div className="race-top">
        <span className="progress-text">第 {idx + 1} / {questions.length} 题</span>
        <span className={urgent ? 'timer urgent' : 'timer'}>⏱ {mm}:{ss}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      <div className="question">
        {q.a} {q.op === 'add' ? '+' : '−'} {q.b} =
      </div>

      <input
        ref={inputRef}
        className="answer-input"
        type="text"
        inputMode="numeric"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        aria-label="答案"
      />

      <div className="keypad">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
          <button key={k} onClick={() => setInput((v) => v + k)}>{k}</button>
        ))}
        <button onClick={() => setInput((v) => v.slice(0, -1))}>⌫</button>
        <button onClick={() => setInput((v) => v + '0')}>0</button>
        <button className="ok" onClick={submit}>✓</button>
      </div>

      <button className="ghost danger" onClick={() => finish('submit')}>提前交卷</button>
    </div>
  )
}
