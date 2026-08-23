import { useEffect, useState } from 'react'
import { battleState, type BattleRoom } from '../api/battle'

// 对战排行榜：轮询 room 状态；server 未启动时静默隐藏（单机模式）
export default function BattleBoard({ code, me }: { code: string; me: string }) {
  const [room, setRoom] = useState<BattleRoom | null>(null)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const r = await battleState(code)
      if (!stop && r) setRoom(r)
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { stop = true; clearInterval(t) }
  }, [code])

  if (!room || room.players.length < 2) return null

  const ranked = [...room.players].sort((a, b) =>
    (b.correct - a.correct) || ((a.usedMs ?? Infinity) - (b.usedMs ?? Infinity)))

  return (
    <div className="battle-board">
      <h3>🏁 对战排行</h3>
      {ranked.map((p, i) => (
        <div key={p.nickname} className={p.nickname === me ? 'battle-row me' : 'battle-row'}>
          <span>{i + 1}. {p.nickname}</span>
          <span>
            {p.usedMs !== null
              ? `✅ ${p.correct} 对 · ${Math.round(p.usedMs / 1000)}s`
              : `答题中… 已对 ${p.correct}`}
          </span>
        </div>
      ))}
    </div>
  )
}
