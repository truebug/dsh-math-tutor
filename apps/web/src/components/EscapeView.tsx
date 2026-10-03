import { useEffect, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { StageDef } from '../lib/adventure'

interface Props {
  settings: StageDef
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

// 「逃离切尔诺贝利」动作关卡：内嵌独立 HTML 小游戏（public/escape/），通关后 postMessage 回报
export default function EscapeView({ settings, onAbandon, onFinish }: Props) {
  const [toast, setToast] = useState('')
  const doneRef = useRef(false)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; won?: boolean } | null
      if (!d || d.type !== 'chernobyl-escape') return
      if (!d.won) {
        setToast('撤离失败，可以在游戏内点「再试一次」')
        setTimeout(() => setToast(''), 3000)
        return
      }
      if (doneRef.current) return
      doneRef.current = true
      const usedMs = Date.now() - startRef.current
      const questions: Question[] = [
        { index: 0, a: 0, b: 0, op: 'add', text: '成功逃离切尔诺贝利核电站', answer: 0, carry: false, options: ['成功', '失败'], answerText: '成功' },
      ]
      onFinish({ answers: ['成功'], perQuestionMs: [usedMs], usedMs, finishedBy: 'submit', questions })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [onFinish])

  return (
    <div className="escape-wrap">
      <div className="escape-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <span className="escape-title">{settings.emoji} {settings.name}</span>
        <span className="escape-tip">键盘操作：←→ 移动 · ↑↓ 爬梯 · 空格跳跃 · ↓ 蹲伏</span>
      </div>
      {toast && <div className="escape-toast">{toast}</div>}
      <iframe className="escape-frame" src={`${import.meta.env.BASE_URL}escape/index.html`} title="逃离切尔诺贝利" />
    </div>
  )
}
