import { useState } from 'react'
import { encodeRaceCode } from '../lib/raceCode'
import { fetchReview } from '../api/review'
import { saveReview, profileSummary } from '../lib/profile'
import { syncEnabled, getFamilyId } from '../lib/sync'
import { starsFor, totalStars, petStage } from '../lib/adventure'
import { sfx } from '../lib/sound'
import { useEffect } from 'react'
import BattleBoard from './BattleBoard'
import Sprite from './Sprite'
import { burst } from '../lib/particles'
import { useRef } from 'react'
import type { LearnerProfile } from '../lib/types'
import type { RaceSettings, SessionRecord } from '../lib/types'
import { classifyError, PATTERN_LABELS } from '../lib/errorPatterns'
import type { ScoreResult } from '../lib/score'
import type { Badge } from '../lib/badges'

// 题型标签：让 AI 知道错的是哪类题（拼音/古诗/词义/句型……）
const KIND_LABELS: Record<string, string> = {
  letters: '字母', vocab: '词汇', sentence: '句型', antonym: '反义词',
  chinese: '词语', poem: '古诗', chars: '识字',
  match: '消消乐', poemchain: '接龙', snake: '贪吃蛇',
  whack: '打地鼠', memory: '翻牌',
}

interface Props {
  record: SessionRecord
  profile: LearnerProfile
  scoreResult?: ScoreResult | null
  onRetry: (settings: RaceSettings) => void
  onHome: () => void
  onOpenMistakes: () => void
  newBadges?: Badge[]
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}分${s % 60}秒`
}

// 朗读文本（点评读全文；错题读引号内词字，无引号读题干）
function speakText(text: string, lang = 'zh-CN') {
  if (!('speechSynthesis' in window)) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang
  utt.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utt)
}

function speakQuestion(q: { text: string }, kind?: string) {
  const m = q.text.match(/["「]([^"」]+)["」]/)
  const isEnglish = kind === 'vocab' || kind === 'letters' || kind === 'sentence' || kind === 'antonym'
  speakText(m ? m[1] : q.text, isEnglish ? 'en-US' : 'zh-CN')
}

export default function ResultView({ record, profile, scoreResult, onRetry, onHome, onOpenMistakes, newBadges }: Props) {
  const stars = starsFor(record.correct, record.total)
  const fxRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (stars > 0) sfx.win()
    if (stars >= 2 && fxRef.current) burst(fxRef.current, 'stars', stars === 3 ? 90 : 50)
  }, [])
  const pet = petStage(totalStars())
  const [review, setReview] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<'idle' | 'loading' | 'error'>('idle')

  const askReview = async () => {
    setReviewState('loading')
    try {
      const carryWrong = record.wrong.filter((w) => w.question.carry).length
      const kind = record.settings.kind
      const kindTag = kind ? `[${KIND_LABELS[kind] ?? kind}]` : ''
      // 错因统计：classifyError 现成确定性分类（看错符号/进退位/计算/字词）
      const kindCounts = new Map<string, number>()
      for (const w of record.wrong) {
        const k = classifyError(w.question, w.given)
        if (k) kindCounts.set(k, (kindCounts.get(k) ?? 0) + 1)
      }
      const causeSummary = [...kindCounts.entries()].map(([k, n]) => `${PATTERN_LABELS[k as keyof typeof PATTERN_LABELS]}${n}次`).join('、')
      // 节奏信号：全卷平均用时 vs 题量，判断整体节奏（过快=可能粗心，过慢=可能吃力）
      const avgSec = record.answered > 0 ? record.usedMs / record.answered / 1000 : 0
      const paceNote = record.answered > 0
        ? `全卷平均每题${avgSec.toFixed(1)}秒（${avgSec < 3 ? '节奏偏快，注意是否有粗心秒答' : avgSec > 10 ? '节奏偏慢，可能有畏难或卡顿' : '节奏正常'}）`
        : ''
      const text = await fetchReview({
        grade: profile.grade,
        level: record.settings.level,
        subject: record.settings.subject ?? 'math',
        familyId: getFamilyId() ?? undefined,
        total: record.total,
        correct: record.correct,
        usedSec: Math.round(record.usedMs / 1000),
        carryWrong,
        plainWrong: record.wrong.length - carryWrong,
        history: syncEnabled() ? profileSummary() : undefined,
        wrongExamples: [
          ...record.wrong.slice(0, 8).map((w) =>
            `${kindTag}${w.question.text} 正确${w.question.answerText ?? w.question.answer}，孩子答 ${w.given ?? '未作答'}`),
          ...(causeSummary ? [`错因统计：${causeSummary}`] : []),
          ...(paceNote ? [paceNote] : []),
        ],
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
      <canvas ref={fxRef} className="fx-canvas" aria-hidden />
      <h1>📊 成绩报告</h1>
      <p className="praise">{praise}</p>
      <p className="stars-line">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)} <small>{pet.emoji} {pet.name}</small></p>

      {/* 新勋章：本次练习解锁的，弹窗庆祝 */}
      {newBadges && newBadges.length > 0 && (
        <div className="badge-toast">
          <b>🎉 获得新勋章！</b>
          <div className="badge-toast-row">
            {newBadges.map((b) => (
              <div key={b.id} className="badge-item">
                <span className="badge-emoji">{b.emoji}</span>
                <b>{b.name}</b>
                <small>{b.desc}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat"><b>{record.correct}</b><span>答对 / {record.total} 题</span></div>
        <div className="stat"><b>{Math.round(record.accuracy * 100)}%</b><span>正确率</span></div>
        <div className="stat"><b>{fmt(record.usedMs)}</b><span>{record.finishedBy === 'timeout' ? '时间到' : '用时'}</span></div>
        <div className="stat"><b>{avg}s</b><span>平均每题</span></div>
      </div>

      {/* 积分奖励：每日打卡/破个人记录/破全服记录/满分 */}
      {scoreResult && (scoreResult.dailyBonus + scoreResult.recordBonus + scoreResult.serverRecordBonus + scoreResult.fullScoreBonus > 0) && (
        <div className="score-bonus">
          {scoreResult.dailyBonus > 0 && <div className="bonus-row">📅 每日打卡 <b>+{scoreResult.dailyBonus}</b></div>}
          {scoreResult.recordBonus > 0 && <div className="bonus-row">🏅 破个人记录 <b>+{scoreResult.recordBonus}</b></div>}
          {scoreResult.serverRecordBonus > 0 && <div className="bonus-row crown">👑 破全服记录 <b>+{scoreResult.serverRecordBonus}</b></div>}
          {scoreResult.fullScoreBonus > 0 && <div className="bonus-row">💯 满分奖励 <b>+{scoreResult.fullScoreBonus}</b></div>}
          <div className="bonus-total">总积分 <b>{scoreResult.totalPoints}</b> · 全服排名 <b>#{scoreResult.rank}</b></div>
        </div>
      )}

      {record.wrong.length > 0 && (
        <div className="wrong-list">
          {/* 主动性：练习后复盘邀请（小精灵主动开口，引导趁热打铁） */}
          <div className="recap-invite">
            <span className="recap-sprite">🧚</span>
            <div className="recap-text">
              <b>小精灵：这次有 {record.wrong.length} 道错题，趁热打铁效果最好！</b>
              <p>现在花一分钟看看错在哪，明天就不容易再错啦。</p>
            </div>
            <button className="primary small" onClick={onOpenMistakes}>去复盘 →</button>
          </div>
          <h3>本次错题（{record.wrong.length}）</h3>
          {record.wrong.map((w, i) => (
            <div key={i} className="wrong-item">
              <span>{w.question.text}</span>
              <button className="speak-btn" title="朗读" onClick={() => speakQuestion(w.question, record.settings.kind)}>🔊</button>
              <span className="given">你的答案：{w.given ?? '未作答'}</span>
              <span className="right">正确：{w.question.answerText ?? w.question.answer}</span>
            </div>
          ))}
        </div>
      )}

      {review ? (
        <>
          <Sprite grade={profile.grade} bubble={review} />
          <div className="review-card">
            <b>✨ 老师点评</b>
            <button className="speak-btn" title="朗读点评" onClick={() => speakText(review)}>🔊</button>
            <p>{review}</p>
          </div>
        </>
      ) : (
        <>
          <button className="primary" onClick={askReview} disabled={reviewState === 'loading'}>
            {reviewState === 'loading' ? '老师正在看错题…' : reviewState === 'error' ? '点评失败，再试一次' : '✨ AI 点评'}
          </button>
        </>
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
