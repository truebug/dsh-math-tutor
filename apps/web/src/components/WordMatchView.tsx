// 单词消消乐：英文卡片 ↔ 中文卡片配对消除
// 配对结果合成标准答题记录（首点即中=答对），星星/错题本/AI 点评全链路复用
import { useMemo, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import { matchPairs, matchQuestions } from '../lib/arcade'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

interface Card { key: string; text: string; pairIdx: number; side: 'en' | 'zh' }

export default function WordMatchView({ settings, onAbandon, onFinish }: Props) {
  const seed = settings.seed
  const pairs = useMemo(() => matchPairs(settings.stageId ?? 'arc-match1', seed, settings.count), [settings.stageId, seed, settings.count])
  const questions = useMemo(() => matchQuestions(pairs, seed), [pairs, seed])
  const cards = useMemo<Card[]>(() => {
    const rng = pairs.map((_, i) => i)  // 仅用种子洗牌布局
    let s = seed >>> 0
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const all: Card[] = pairs.flatMap((p, i) => [
      { key: `e${i}`, text: p.en, pairIdx: i, side: 'en' as const },
      { key: `z${i}`, text: p.zh, pairIdx: i, side: 'zh' as const },
    ])
    for (let i = all.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
    void rng
    return all
  }, [pairs, seed])

  const [gone, setGone] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Card | null>(null)
  const [badKeys, setBadKeys] = useState<Set<string>>(new Set())
  const startRef = useRef(Date.now())
  const bornRef = useRef<Record<number, number>>({})   // 每对卡片“可看”时间
  const answersRef = useRef<Array<string | null>>(pairs.map(() => null))
  const msRef = useRef<number[]>(pairs.map(() => 0))
  const doneRef = useRef(false)

  const finish = (by: 'submit' | 'timeout') => {
    if (doneRef.current) return
    doneRef.current = true
    onFinish({
      answers: answersRef.current,
      perQuestionMs: msRef.current,
      usedMs: Date.now() - startRef.current,
      finishedBy: by,
      questions,
    })
  }

  const tap = (card: Card) => {
    if (gone.has(card.key) || doneRef.current) return
    const born = bornRef.current[card.pairIdx] ?? (bornRef.current[card.pairIdx] = Date.now())
    if (!picked) { setPicked(card); return }
    if (picked.key === card.key) { setPicked(null); return }
    if (picked.pairIdx === card.pairIdx) {
      // 配对成功：两张都是“首点即中”才算答对（第一张卡先被选不判错，错配发生在第二次点选）
      if (answersRef.current[card.pairIdx] === null) {
        answersRef.current[card.pairIdx] = questions[card.pairIdx].answerText ?? ''
        msRef.current[card.pairIdx] = Date.now() - born
      }
      const ng = new Set(gone); ng.add(picked.key); ng.add(card.key)
      setGone(ng); setPicked(null)
      if (ng.size === cards.length) finish('submit')
    } else {
      // 错配：以先选卡的所属题记为答错（只记一次）
      const idx = picked.pairIdx
      if (answersRef.current[idx] === null) {
        answersRef.current[idx] = card.text
        msRef.current[idx] = Date.now() - born
      }
      setBadKeys(new Set([picked.key, card.key]))
      setPicked(null)
      setTimeout(() => setBadKeys(new Set()), 450)
    }
  }

  const left = cards.length - gone.size
  return (
    <div className="race game-shell">
      <header className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <b>🧩 {settings.stageId === 'arc-match3' ? '消消乐·大师' : settings.stageId === 'arc-match2' ? '消消乐·进阶' : '消消乐·热身'}</b>
        <span className="game-progress">剩 {left / 2} 对</span>
      </header>
      <p className="game-tip">点一张英文，再点它的中文意思，配成一对就消除！</p>
      <div className="match-grid">
        {cards.map((c) => (
          <button
            key={c.key}
            className={`match-card ${c.side}${gone.has(c.key) ? ' gone' : ''}${picked?.key === c.key ? ' picked' : ''}${badKeys.has(c.key) ? ' bad' : ''}`}
            disabled={gone.has(c.key)}
            onClick={() => tap(c)}
          >
            {gone.has(c.key) ? '✨' : c.text}
          </button>
        ))}
      </div>
    </div>
  )
}
