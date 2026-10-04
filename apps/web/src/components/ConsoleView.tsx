import { useEffect, useRef, useState } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { StageDef } from '../lib/adventure'

interface Props {
  settings: StageDef
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout'; questions: Question[] }) => void
}

// 「控制室上岗培训」：内嵌独立 HTML 模拟器（public/console/），通关后 postMessage 回报
// 与核电站主控实践/逃离切尔诺贝利组成三部曲序章
export default function ConsoleView({ settings, onAbandon, onFinish }: Props) {
  const [toast, setToast] = useState('')
  const doneRef = useRef(false)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; won?: boolean; done?: boolean[] } | null
      if (!d || d.type !== 'nuclear-console') return
      if (!d.won) {
        setToast('培训未通过，可以在游戏内点「再试一次」')
        setTimeout(() => setToast(''), 3000)
        return
      }
      if (doneRef.current) return
      doneRef.current = true
      const usedMs = Date.now() - startRef.current
      const doneArr = d.done ?? [true, true, true, true]
      const names = ['① 启动反应堆', '② 稳定运行', '③ 警报处置', '④ 交接班停堆']
      const questions: Question[] = names.map((name, i) => ({
        index: i, a: 0, b: 0, op: 'add', text: name, answer: 0,
        carry: false, options: ['完成', '未完成'], answerText: doneArr[i] ? '完成' : '未完成',
      }))
      onFinish({ answers: names.map((_, i) => (doneArr[i] ? '完成' : '未完成')), perQuestionMs: names.map(() => usedMs / names.length), usedMs, finishedBy: 'submit', questions })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [onFinish])

  return (
    <div className="escape-wrap">
      <div className="escape-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <span className="escape-title">{settings.emoji} {settings.name}</span>
        <span className="escape-tip">按顶部任务条提示操作控制台 · 注意右侧警报面板</span>
      </div>
      {toast && <div className="escape-toast">{toast}</div>}
      <iframe className="escape-frame" src={`${import.meta.env.BASE_URL}console/index.html`} title="控制室上岗培训" />
    </div>
  )
}
