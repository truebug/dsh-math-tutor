// 成绩单分享卡：Canvas 生成 PNG，可保存/系统分享，家长会传播的自然载体
import { useEffect, useRef, useState } from 'react'
import type { SessionRecord } from '../lib/types'
import { starsFor } from '../lib/adventure'

interface Props {
  record: SessionRecord
  nickname: string
}

const SUBJECT_LABEL: Record<string, string> = { math: '数学', chinese: '语文', english: '英语', arcade: '游乐场' }

function draw(canvas: HTMLCanvasElement, record: SessionRecord, nickname: string) {
  const W = 640; const H = 800
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')
  if (!c) return
  const bg = c.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#fdf6e3'); bg.addColorStop(1, '#f3e2b8')
  c.fillStyle = bg
  c.fillRect(0, 0, W, H)
  c.strokeStyle = 'rgba(146,104,48,.5)'; c.lineWidth = 6
  c.strokeRect(14, 14, W - 28, H - 28)
  c.textAlign = 'center'
  c.fillStyle = '#6b5232'; c.font = '28px sans-serif'
  c.fillText('🗺️ 知识大陆 · 练习成绩单', W / 2, 78)
  c.fillStyle = '#3a2a14'; c.font = 'bold 44px sans-serif'
  c.fillText(nickname, W / 2, 150)
  c.fillStyle = '#8a6f47'; c.font = '24px sans-serif'
  const subject = SUBJECT_LABEL[record.settings.subject ?? 'math'] ?? '练习'
  const date = new Date(record.date).toLocaleDateString('zh-CN')
  c.fillText(`${date} · ${subject}`, W / 2, 192)
  const stars = starsFor(record.correct, record.total)
  c.font = '64px sans-serif'
  c.fillText('⭐'.repeat(stars) + '☆'.repeat(3 - stars), W / 2, 300)
  const stats: Array<[string, string]> = [
    [`${record.correct}/${record.total}`, '答对题数'],
    [`${Math.round(record.accuracy * 100)}%`, '正确率'],
    [`${Math.floor(record.usedMs / 60000)}分${Math.round(record.usedMs / 1000) % 60}秒`, '用时'],
  ]
  stats.forEach(([v, label], i) => {
    const x = W / 2 + (i - 1) * 190
    c.fillStyle = '#2a4a7a'; c.font = 'bold 46px sans-serif'
    c.fillText(v, x, 420)
    c.fillStyle = '#66788f'; c.font = '22px sans-serif'
    c.fillText(label, x, 456)
  })
  const praise = record.accuracy >= 1 ? '满分！太厉害了 🎉'
    : record.accuracy >= 0.8 ? '非常棒，继续保持！💪'
    : record.accuracy >= 0.6 ? '不错哦，再练一练更稳！🌱'
    : '敢于挑战就是进步，错题复盘后再来！🌈'
  c.fillStyle = '#b8860b'; c.font = 'bold 30px sans-serif'
  c.fillText(praise, W / 2, 560)
  c.fillStyle = '#98a4b5'; c.font = '20px sans-serif'
  c.fillText('和我一起挑战 → 120.27.200.203:2008/dsh-math-tutor', W / 2, 736)
}

export default function ShareCard({ record, nickname }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (open && ref.current) draw(ref.current, record, nickname)
  }, [open, record, nickname])

  const save = () => {
    const url = ref.current?.toDataURL('image/png')
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `成绩单-${nickname}-${new Date(record.date).toISOString().slice(0, 10)}.png`
    a.click()
  }

  const share = async () => {
    const blob = await new Promise<Blob | null>((r) => ref.current?.toBlob(r, 'image/png'))
    const file = blob ? new File([blob], '成绩单.png', { type: 'image/png' }) : null
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '我的练习成绩单' }).catch(() => {})
    } else {
      save()
    }
  }

  if (!open) {
    return <button className="ghost" onClick={() => setOpen(true)}>📸 分享成绩</button>
  }
  return (
    <div className="share-card">
      <canvas ref={ref} className="share-canvas" />
      <div className="btn-row">
        <button className="primary small" onClick={share}>📤 分享 / 保存</button>
        <button className="ghost small" onClick={() => setOpen(false)}>收起</button>
      </div>
    </div>
  )
}
