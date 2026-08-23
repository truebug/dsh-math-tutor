import { useState } from 'react'
import { encodeRaceCode } from '../lib/raceCode'
import { fetchReview } from '../api/review'
import { saveReview } from '../lib/profile'
import { starsFor, totalStars, petStage } from '../lib/adventure'
import { sfx } from '../lib/sound'
import { useEffect } from 'react'
import BattleBoard from './BattleBoard'
import type { LearnerProfile } from '../lib/types'
import type { RaceSettings, SessionRecord } from '../lib/types'

interface Props {
  record: SessionRecord
  profile: LearnerProfile
  onRetry: (settings: RaceSettings) => void
  onHome: () => void
  onOpenMistakes: () => void
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}分${s % 60}秒`
}

export default function ResultView({ record, profile, onRetry, onHome, onOpenMistakes }: Props) {
  const stars = starsFor(record.correct, record.total)
  useEffect(() => { if (stars > 0) sfx.win() }, [])
  const pet = petStage(totalStars())
  const [review, setReview] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<'idle' | 'loading' | 'error'>('idle')

  const askReview = async () => {
    setReviewState('loading')
    try {
      const carryWrong = record.wrong.filter((w) => w.question.carry).length
      const text = await fetchReview({
        grade: profile.grade,
        level: record.settings.level,
        total: record.total,
        correct: record.correct,
        usedSec: Math.round(record.usedMs / 1000),
        carryWrong,
        plainWrong: record.wrong.length - carryWrong,
        wrongExamples: record.wrong.slice(0, 5).map((w) =>
          `${w.question.text} 正确${w.question.answer}，孩子答 ${w.given ?? '未作答'}`),
      })
      setReview(text)
      setReviewState('idle')
      saveReview(record.id, text)   // 点评落本地画像（agent 记忆基础数据）
    } catch {
      setReviewState('error')
    }
  }
  const { settings } = record
  const avg = record.answered > 0 ? Math.round(record.usedMs / record.answered / 100) / 10 : 0
  const praise =
    record.accuracy === 1 ? '满分！太厉害了 🏆' :
    record.accuracy >= 0.9 ? '非常棒，差一点点满分 🌟' :
    record.accuracy >= 0.7 ? '不错，继续加油 💪' : '别灰心，错题本里练一练 📒'

  return (
    <div className="card">
      <h1>📊 成绩报告</h1>
      <p className="praise">{praise}</p>
      <p className="stars-line">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)} <small>{pet.emoji} {pet.name}</small></p>

      <div className="stats">
        <div className="stat"><b>{record.correct}</b><span>答对 / {record.total} 题</span></div>
        <div className="stat"><b>{Math.round(record.accuracy * 100)}%</b><span>正确率</span></div>
        <div className="stat"><b>{fmt(record.usedMs)}</b><span>{record.finishedBy === 'timeout' ? '时间到' : '用时'}</span></div>
        <div className="stat"><b>{avg}s</b><span>平均每题</span></div>
      </div>

      {record.wrong.length > 0 && (
        <div className="wrong-list">
          <h3>本次错题（{record.wrong.length}）</h3>
          {record.wrong.map((w, i) => (
            <div key={i} className="wrong-item">
              <span>{w.question.text}</span>
              <span className="given">你的答案：{w.given ?? '未作答'}</span>
              <span className="right">正确：{w.question.answer}</span>
            </div>
          ))}
        </div>
      )}

      {review ? (
        <div className="review-card">
          <b>✨ 老师点评</b>
          <p>{review}</p>
        </div>
      ) : (
        <button className="primary" onClick={askReview} disabled={reviewState === 'loading'}>
          {reviewState === 'loading' ? '老师正在看错题…' : reviewState === 'error' ? '点评失败，再试一次' : '✨ AI 点评'}
        </button>
      )}

      <div className="btn-row">
        <button className="primary" onClick={() => onRetry({ ...settings, seed: Math.floor(Math.random() * 1e9) })}>
          再来一组 🔁
        </button>
        <button className="ghost" onClick={onOpenMistakes}>错题本 📒</button>
        <button className="ghost" onClick={onHome}>返回首页</button>
      </div>

      <BattleBoard code={encodeRaceCode(settings)} me={profile.nickname} />

      <p className="race-code-line">
        本次竞赛码：<code>{encodeRaceCode(settings)}</code>
        <button className="ghost" onClick={() => navigator.clipboard?.writeText(encodeRaceCode(settings))}>复制</button>
      </p>
    </div>
  )
}
