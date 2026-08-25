// 辅助小精灵：与孩子养的宠物合体——宠物即学习伙伴，随星星进化、越来越会教
import { useState } from 'react'
import { getFamilyId } from '../lib/sync'
import { petStage, totalStars } from '../lib/adventure'
import type { Question } from '@dsh-math-tutor/math-generator/core'

// 确定性即时提示（零延迟零成本）
export function quickHint(q: Question): string {
  if (q.options) return '想一想字母歌，或者这句话在课堂上听过哦～'
  if (q.op === 'add' && q.carry) return '个位相加满 10 啦，记得向十位进 1 哦'
  if (q.op === 'sub' && q.carry) return '个位不够减，向十位借 1 当 10 再减'
  if (q.op === 'add') return '把个位和十位分开加，再合起来试试'
  if (q.op === 'sub') return '从个位开始，一位一位地减'
  if (q.op === 'mul') return '想一想乘法口诀，几乘几呢？'
  return '倒过来想：几乘除数等于被除数？'
}

interface Props {
  question?: Question | null
  wrongGiven?: string | number | null
  grade: 2 | 3 | 4 | 5
  bubble?: string | null   // 外部注入的气泡内容（如成绩页点评）
}

export default function Sprite({ question, wrongGiven, grade, bubble }: Props) {
  const pet = petStage(totalStars())
  const [tip, setTip] = useState<string | null>(bubble ?? null)
  const [asking, setAsking] = useState(false)
  const shown = tip ?? bubble ?? null

  const payload = () => JSON.stringify({
    grade,
    question: question!.text,
    wrongAnswer: String(wrongGiven ?? '未作答'),
    correctAnswer: String(question!.answerText ?? question!.answer),
    familyId: getFamilyId() ?? undefined,
  })

  // SSE 优先（逐字呈现），失败回退一次性 JSON
  const ask = async () => {
    if (!question || asking) return
    setAsking(true)
    setTip('')
    try {
      const res = await fetch('/api/hint/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload(),
      })
      if (!res.ok || !res.body) throw new Error('stream_unavailable')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let acc = ''
      let failed = false
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const evt = JSON.parse(data) as { delta?: string; error?: string }
            if (evt.error) { failed = true; break }
            if (evt.delta) { acc += evt.delta; setTip(acc) }
          } catch { /* 半包忽略 */ }
        }
        if (failed) break
      }
      if (failed || !acc) throw new Error('stream_failed')
    } catch {
      try {
        const res = await fetch('/api/hint', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload(),
        })
        const data = (await res.json()) as { text?: string }
        setTip(data.text ?? '小精灵累了，稍后再问我吧～')
      } catch {
        setTip(quickHint(question))
      }
    }
    setAsking(false)
  }

  return (
    <div className="sprite">
      {shown && (
        <div className="sprite-bubble">
          <p>{shown}</p>
          {question && wrongGiven != null && !tip?.includes('小精灵') && (
            <button className="sprite-ask" onClick={ask} disabled={asking}>
              {asking ? '思考中…' : '✨ 详细讲解'}
            </button>
          )}
        </div>
      )}
      <button
        className="sprite-avatar"
        aria-label="学习小精灵"
        onClick={() => setTip(shown ? null : (question ? quickHint(question) : `你好呀！我是${pet.name}，一起加油！`))}
      >
        {pet.emoji}
      </button>
    </div>
  )
}
