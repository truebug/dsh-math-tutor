// 打地鼠：九宫格随机冒出卡片，敲中与提示匹配的那张
// 判分：敲中目标=答对进下一轮；敲错卡片=该轮记答错并立即换下一轮
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import { whackRounds } from '../lib/arcade'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

const HOLES = 9

export default function WhackView({ settings, onAbandon, onFinish }: Props) {
  const isChinese = settings.stageId === 'arc-whack1'
  const { rounds, questions } = useMemo(
    () => whackRounds(settings.stageId ?? 'arc-whack1', settings.seed, settings.count),
    [settings.stageId, settings.seed, settings.count],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const [holes, setHoles] = useState<Array<{ text: string; isTarget: boolean } | null>>(Array(HOLES).fill(null))
  const [hit, setHit] = useState<number | null>(null)   // 被敲的洞索引（动画）
  const startRef = useRef(Date.now())
  const qBornRef = useRef(Date.now())
  const answersRef = useRef<Array<string | null>>(rounds.map(() => null))
  const msRef = useRef<number[]>(rounds.map(() => 0))
  const doneRef = useRef(false)
  const roundIdxRef = useRef(0)
  roundIdxRef.current = roundIdx

  const finish = (by: 'submit' | 'timeout') => {
    if (doneRef.current) return
    doneRef.current = true
    onFinish({ answers: answersRef.current, perQuestionMs: msRef.current, usedMs: Date.now() - startRef.current, finishedBy: by, questions })
  }

  // 每轮布洞：目标 1 个 + 干扰 8 个全部进洞，位置洗牌（确定性种子+轮次）
  useEffect(() => {
    const r = rounds[roundIdxRef.current]
    let s = (settings.seed ^ (roundIdxRef.current * 104729)) >>> 0
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const all = [{ text: r.target, isTarget: true }, ...r.decoys.slice(0, HOLES - 1).map((text) => ({ text, isTarget: false }))]
    for (let i = all.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
    setHoles(all)
    setHit(null)
    qBornRef.current = Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx])

  const whack = (holeIdx: number) => {
    if (doneRef.current || hit !== null) return
    const hole = holes[holeIdx]
    if (!hole) return
    const i = roundIdxRef.current
    setHit(holeIdx)
    answersRef.current[i] = hole.isTarget ? rounds[i].target : hole.text
    msRef.current[i] = Date.now() - qBornRef.current
    setTimeout(() => {
      if (i + 1 >= rounds.length) finish('submit')
      else setRoundIdx(i + 1)
    }, hole.isTarget ? 420 : 750)
  }

  const round = rounds[roundIdx]
  return (
    <div className="race game-shell">
      <header className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <b>{isChinese ? '🔨 地鼠·识字' : '🐹 地鼠·单词'}</b>
        <span className="game-progress">{roundIdx + 1} / {rounds.length}</span>
      </header>
      <p className="whack-prompt">
        {isChinese ? <>敲出拼音 <b>「{round.prompt}」</b> 的字！</> : <>敲出 <b>「{round.prompt}」</b> 的英文！</>}
      </p>
      <div className="whack-grid">
        {holes.map((h, i) => (
          <button
            key={i}
            className={`whack-hole${hit === i ? (h?.isTarget ? ' hit-ok' : ' hit-no') : ''}`}
            onClick={() => whack(i)}
          >
            <span className="whack-card">{h?.text}</span>
            {hit === i && <span className="whack-burst">{h?.isTarget ? '⭐' : '💥'}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
