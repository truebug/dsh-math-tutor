// 翻牌记忆：卡片扣着，凭记忆翻两张配对（消消乐的记忆版）
// 判分：每对卡片"首次翻对"才算答对；翻错一次即该对记答错（考察真记忆）
import { useMemo, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import { memoryPairs, matchQuestions } from '../lib/arcade'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

interface Card { key: string; text: string; pairIdx: number; side: 'en' | 'zh' }

export default function MemoryView({ settings, onAbandon, onFinish }: Props) {
  const seed = settings.seed
  const pairs = useMemo(() => memoryPairs(settings.stageId ?? 'arc-memory1', seed, settings.count), [settings.stageId, seed, settings.count])
  const questions = useMemo(() => matchQuestions(pairs, seed), [pairs, seed])
  const cards = useMemo<Card[]>(() => {
    let s = seed >>> 0
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const all: Card[] = pairs.flatMap((p, i) => [
      { key: `e${i}`, text: p.en, pairIdx: i, side: 'en' as const },
      { key: `z${i}`, text: p.zh, pairIdx: i, side: 'zh' as const },
    ])
    for (let i = all.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
    return all
  }, [pairs, seed])

  const [faceUp, setFaceUp] = useState<Set<string>>(new Set())   // 本回合翻开但未配对
  const [gone, setGone] = useState<Set<string>>(new Set())
  const startRef = useRef(Date.now())
  const bornRef = useRef<Record<number, number>>({})
  const answersRef = useRef<Array<string | null>>(pairs.map(() => null))
  const msRef = useRef<number[]>(pairs.map(() => 0))
  const failedRef = useRef<Set<number>>(new Set())   // 已翻错过的对
  const busyRef = useRef(false)
  const doneRef = useRef(false)

  const finish = (by: 'submit' | 'timeout') => {
    if (doneRef.current) return
    doneRef.current = true
    onFinish({ answers: answersRef.current, perQuestionMs: msRef.current, usedMs: Date.now() - startRef.current, finishedBy: by, questions })
  }

  const flip = (card: Card) => {
    if (busyRef.current || doneRef.current || gone.has(card.key) || faceUp.has(card.key)) return
    const born = bornRef.current[card.pairIdx] ?? (bornRef.current[card.pairIdx] = Date.now())
    const open = [...faceUp].map((k) => cards.find((c) => c.key === k)!).filter(Boolean)
    if (open.length === 0) { setFaceUp(new Set([card.key])); return }
    // 第二张：判定
    const first = open[0]
    busyRef.current = true
    if (first.pairIdx === card.pairIdx && first.key !== card.key) {
      // 配对成功：该对没翻错过才算答对
      const idx = card.pairIdx
      if (answersRef.current[idx] === null) {
        answersRef.current[idx] = failedRef.current.has(idx) ? first.text : (questions[idx].answerText ?? '')
        msRef.current[idx] = Date.now() - born
      }
      setFaceUp(new Set([...faceUp, card.key]))
      setTimeout(() => {
        const ng = new Set(gone); ng.add(first.key); ng.add(card.key)
        setGone(ng); setFaceUp(new Set()); busyRef.current = false
        if (ng.size === cards.length) finish('submit')
      }, 450)
    } else {
      // 翻错：两个对都标记失败（若还没记录）
      for (const idx of [first.pairIdx, card.pairIdx]) {
        if (answersRef.current[idx] === null && failedRef.current.has(idx)) {
          answersRef.current[idx] = first.text
          msRef.current[idx] = Date.now() - (bornRef.current[idx] ?? born)
        }
        failedRef.current.add(idx)
      }
      setFaceUp(new Set([...faceUp, card.key]))
      setTimeout(() => { setFaceUp(new Set()); busyRef.current = false }, 900)
    }
  }

  const left = (cards.length - gone.size) / 2
  return (
    <div className="race game-shell">
      <header className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <b>🃏 翻牌记忆</b>
        <span className="game-progress">剩 {left} 对</span>
      </header>
      <p className="game-tip">记住每张牌的位置！翻一张英文，再凭记忆翻出它的中文。</p>
      <div className="match-grid">
        {cards.map((c) => {
          const up = faceUp.has(c.key) || gone.has(c.key)
          return (
            <button
              key={c.key}
              className={`match-card memory${gone.has(c.key) ? ' gone' : ''}${up ? ` up ${c.side}` : ''}`}
              disabled={gone.has(c.key)}
              onClick={() => flip(c)}
            >
              {gone.has(c.key) ? '✨' : up ? c.text : '🎴'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
