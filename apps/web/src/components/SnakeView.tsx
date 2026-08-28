// 数字贪吃蛇：蛇在棋盘上移动，吃掉带正确答案的食物
// 设计见 docs/arcade-games.md：吃对=答对进下一题；吃错=记错并换题；撞墙/撞自己不扣分只转向重来
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import { snakeRounds, snakeTickMs } from '../lib/arcade'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

const COLS = 15
const ROWS = 15
type Dir = 'up' | 'down' | 'left' | 'right'
interface Cell { x: number; y: number }
interface Food extends Cell { value: number }

const OP_GLYPHS: Record<string, string> = { add: '+', sub: '−', mul: '×', div: '÷' }

export default function SnakeView({ settings, onAbandon, onFinish }: Props) {
  const { rounds, questions } = useMemo(
    () => snakeRounds(settings.stageId ?? 'arc-snake1', settings.seed, settings.count, settings.level),
    [settings.stageId, settings.seed, settings.count, settings.level],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const [snake, setSnake] = useState<Cell[]>([{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }])
  const [foods, setFoods] = useState<Food[]>([])
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const dirRef = useRef<Dir>('right')
  const pendingRef = useRef<Dir | null>(null)
  const aliveRef = useRef(true)
  const startRef = useRef(Date.now())
  const qBornRef = useRef(Date.now())
  const answersRef = useRef<Array<number | null>>(rounds.map(() => null))
  const msRef = useRef<number[]>(rounds.map(() => 0))
  const doneRef = useRef(false)
  const snakeRef = useRef(snake)
  snakeRef.current = snake
  const foodsRef = useRef(foods)
  foodsRef.current = foods
  const roundIdxRef = useRef(roundIdx)
  roundIdxRef.current = roundIdx

  const finish = (by: 'submit' | 'timeout') => {
    if (doneRef.current) return
    doneRef.current = true
    aliveRef.current = false
    onFinish({ answers: answersRef.current, perQuestionMs: msRef.current, usedMs: Date.now() - startRef.current, finishedBy: by, questions })
  }

  // 每轮布食物：随机空格放 4 个数字
  useEffect(() => {
    const free: Cell[] = []
    for (let x = 0; x < COLS; x += 1) for (let y = 0; y < ROWS; y += 1) {
      if (!snakeRef.current.some((s) => s.x === x && s.y === y)) free.push({ x, y })
    }
    const placed: Food[] = []
    let s = (settings.seed ^ (roundIdx * 7919)) >>> 0
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    for (const value of rounds[roundIdx].foods) {
      const i = Math.floor(rnd() * free.length)
      const c = free.splice(i, 1)[0]
      if (c) placed.push({ ...c, value })
    }
    setFoods(placed)
    qBornRef.current = Date.now()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx])

  // 主循环
  useEffect(() => {
    const tick = snakeTickMs(settings.level)
    const timer = setInterval(() => {
      if (!aliveRef.current || doneRef.current) return
      if (pendingRef.current) { dirRef.current = pendingRef.current; pendingRef.current = null }
      const head = { ...snakeRef.current[0] }
      if (dirRef.current === 'up') head.y -= 1
      if (dirRef.current === 'down') head.y += 1
      if (dirRef.current === 'left') head.x -= 1
      if (dirRef.current === 'right') head.x += 1
      // 撞墙/撞自己：回到起点重置，不判错（低幼友好）
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snakeRef.current.some((s) => s.x === head.x && s.y === head.y)) {
        setSnake([{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }])
        dirRef.current = 'right'
        return
      }
      const ate = foodsRef.current.find((f) => f.x === head.x && f.y === head.y)
      const next = [head, ...snakeRef.current]
      if (!ate) next.pop()
      setSnake(next)
      if (ate) {
        const i = roundIdxRef.current
        const q = rounds[i].question
        const ok = ate.value === q.answer
        if (answersRef.current[i] === null) {
          answersRef.current[i] = ate.value
          msRef.current[i] = Date.now() - qBornRef.current
        }
        setFlash(ok ? 'ok' : 'no')
        setTimeout(() => setFlash(null), 350)
        if (i + 1 >= rounds.length) { finish('submit'); return }
        setRoundIdx(i + 1)  // 触发下一轮布食物（对错都前进，限时内尽量多题）
      }
    }, tick)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.level, rounds])

  // 键盘方向
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      const cur = dirRef.current
      if ((d === 'up' && cur !== 'down') || (d === 'down' && cur !== 'up') || (d === 'left' && cur !== 'right') || (d === 'right' && cur !== 'left')) pendingRef.current = d
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const steer = (d: Dir) => {
    const cur = dirRef.current
    if ((d === 'up' && cur !== 'down') || (d === 'down' && cur !== 'up') || (d === 'left' && cur !== 'right') || (d === 'right' && cur !== 'left')) pendingRef.current = d
  }

  // 触屏滑动转向：iPad 上直接划屏比点方向盘更跟手
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return   // 防误触
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }

  const q = rounds[roundIdx].question
  const done = answersRef.current.filter((a) => a !== null).length
  return (
    <div className={`race game-shell snake-shell${flash ? ` flash-${flash}` : ''}`}>
      <header className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <b>🐍 数字贪吃蛇</b>
        <span className="game-progress">{done} / {rounds.length}</span>
      </header>
      <p className="snake-q">{q.a} {OP_GLYPHS[q.op]} {q.b} = <b>?</b> <small>去吃正确的数字！</small></p>
      <div className="snake-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const x = i % COLS
          const y = Math.floor(i / COLS)
          const si = snake.findIndex((s) => s.x === x && s.y === y)
          const food = foods.find((f) => f.x === x && f.y === y)
          return (
            <div key={i} className={`snake-cell${si === 0 ? ' head' : si > 0 ? ' body' : ''}`}>
              {food && <span className="snake-food">{food.value}</span>}
            </div>
          )
        })}
      </div>
      <div className="snake-pad" aria-label="方向盘">
        <button className="pad up" onClick={() => steer('up')}>↑</button>
        <button className="pad left" onClick={() => steer('left')}>←</button>
        <button className="pad down" onClick={() => steer('down')}>↓</button>
        <button className="pad right" onClick={() => steer('right')}>→</button>
      </div>
    </div>
  )
}
