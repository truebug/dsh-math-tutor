import { useEffect, useMemo, useRef, useState } from 'react'
import { generateQuestions, normalizeAnswer, OP_GLYPHS, type Question } from '@dsh-math-tutor/math-generator/core'
import { generateAntonymQuestions, generateLetterQuestions, generateSentenceQuestions, generateVocabQuestions } from '../lib/english'
import { generateChineseQuestions } from '../lib/chinese'
import type { RaceSettings } from '../lib/types'
import { battleJoin, battleScore } from '../api/battle'
import { encodeRaceCode } from '../lib/raceCode'
import { sfx } from '../lib/sound'
import { burst } from '../lib/particles'
import StageArt from './StageArt'
import Sprite, { quickHint } from './Sprite'

interface Props {
  settings: RaceSettings
  nickname: string
  grade: 2 | 3 | 4 | 5
  onAbandon: () => void   // 放弃退出：不记录任何数据（误闯关卡场景）
  onFinish: (result: {
    answers: Array<number | string | null>
    perQuestionMs: number[]
    usedMs: number
    finishedBy: 'submit' | 'timeout'
    questions: Question[]
  }) => void
}

export default function RaceView({ settings, nickname, grade, onAbandon, onFinish }: Props) {
  const code = encodeRaceCode(settings)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const questions = useMemo<Question[]>(
    () => settings.customQuestions
      ?? (settings.kind === 'letters'
        ? generateLetterQuestions(settings.seed, settings.stageId === 'eng-letters2' ? 13 : 0, settings.stageId === 'eng-letters2' ? 26 : 13, settings.count)
        : settings.kind === 'vocab'
          ? generateVocabQuestions(settings.seed, settings.stageId ?? 'eng-greet', settings.count)
          : settings.kind === 'sentence'
            ? generateSentenceQuestions(settings.seed, settings.count)
            : settings.kind === 'antonym'
              ? generateAntonymQuestions(settings.seed, settings.count)
              : settings.kind === 'chinese'
                ? generateChineseQuestions(settings.seed, settings.stageId ?? 'chi-nature', settings.count)
          : generateQuestions({ count: settings.count, max: settings.max, ops: settings.ops, seed: settings.seed, level: settings.level, carryRatio: settings.carryRatio, domain: settings.domain })),
    [settings],
  )
  const isChoice = questions[0]?.options !== undefined
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const correctRef = useRef(0)
  const [streak, setStreak] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const [cheer, setCheer] = useState(0)  // 连击里程碑弹层计数
  const [lastWrong, setLastWrong] = useState<{ q: Question; given: number | string } | null>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)
  const answersRef = useRef<Array<number | string | null>>(Array(questions.length).fill(null))
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
    battleJoin(settings, nickname)   // 加入对战房间（server 不在时静默降级）
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      const left = settings.durationSec - Math.floor((Date.now() - startRef.current) / 1000)
      setRemain(Math.max(left, 0))
      if (left <= 0) finish('timeout')
    }, 250)
    return () => clearInterval(t)
  }, [settings.durationSec])

  useEffect(() => {
    if (!isChoice) inputRef.current?.focus()
  }, [idx, isChoice])

  const quit = () => {
    if (!confirmQuit) {
      setConfirmQuit(true)
      setTimeout(() => setConfirmQuit(false), 3000)
      return
    }
    finishedRef.current = true   // 阻止计时器/交卷再触发 onFinish
    onAbandon()
  }

  const recordAnswer = (value: number | string) => {
    const q = questions[idx]
    answersRef.current[idx] = value
    perQuestionRef.current[idx] = Date.now() - questionStartRef.current
    const expected: number | string = q.answerText ?? q.answer
    const hit = value === expected
    if (hit) {
      correctRef.current += 1
      const next = streak + 1
      setStreak(next)
      setFlash('ok')
      if (next > 0 && next % 5 === 0) {
        sfx.streak()
        setCheer(next)
        if (fxRef.current) burst(fxRef.current, 'embers', 24)
      } else sfx.correct()
    } else {
      setStreak(0)
      setFlash('no')
      sfx.wrong()
      setLastWrong({ q, given: value })   // 答错：小精灵出即时提示
    }
    setTimeout(() => setFlash(null), 350)
    battleScore(settings, nickname, correctRef.current, idx + 1, 0)  // 进度上报；交卷时由 App 带 usedMs 覆盖
    if (idx + 1 >= questions.length) {
      finish('submit')
    } else {
      setIdx(idx + 1)
      setInput('')
      questionStartRef.current = Date.now()
    }
  }

  const submit = () => {
    const value = normalizeAnswer(input)
    if (value === null) return
    recordAnswer(value)
  }

  const q = questions[idx]
  const mm = String(Math.floor(remain / 60)).padStart(2, '0')
  const ss = String(remain % 60).padStart(2, '0')
  const urgent = remain <= 30

  return (
    <div className="card race">
      <canvas ref={fxRef} className="fx-canvas" aria-hidden />
      {settings.stageId && <StageArt stageId={settings.stageId} height={54} />}
      <div className="race-top">
        <button className={confirmQuit ? 'quit-btn confirm' : 'quit-btn'} onClick={quit}>
          {confirmQuit ? '再点一次退出' : '✕ 退出'}
        </button>
        <span className="progress-text">第 {idx + 1} / {questions.length} 题</span>
        {streak >= 3 && <span className="streak">🔥 连对 {streak}</span>}
        <span className={urgent ? 'timer urgent' : 'timer'}>⏱ {mm}:{ss}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      {cheer > 0 && (
        <div className="cheer" onAnimationEnd={() => setCheer(0)}>
          🎉 连对 {cheer} 题！
        </div>
      )}
      <div className={flash === 'ok' ? 'question flash-ok' : flash === 'no' ? 'question flash-no' : 'question'}>
        {isChoice ? q.text : <>{q.a} {OP_GLYPHS[q.op]} {q.b} =</>}
      </div>

      {isChoice ? (
        <div className="choices">
          {q.options!.map((opt) => (
            <button key={opt} className="choice-btn" onClick={() => recordAnswer(opt)}>{opt}</button>
          ))}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            className="answer-input"
            type="text"
            inputMode="decimal"
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
        </>
      )}

      <button className="ghost danger" onClick={() => finish('submit')}>提前交卷</button>

      <Sprite
        question={lastWrong?.q ?? questions[idx]}
        wrongGiven={lastWrong?.given ?? null}
        grade={grade}
        bubble={lastWrong ? quickHint(lastWrong.q) : null}
      />
    </div>
  )
}
