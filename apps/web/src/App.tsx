import { useRef, useState } from 'react'
import OnboardingView from './components/OnboardingView'
import SetupView from './components/SetupView'
import MapView from './components/AdventureMap'
import RaceView from './components/RaceView'
import WordMatchView from './components/WordMatchView'
import PoemChainView from './components/PoemChainView'
import SnakeView from './components/SnakeView'
import WhackView from './components/WhackView'
import MemoryView from './components/MemoryView'
import ResultView from './components/ResultView'
import MistakeBook from './components/MistakeBook'
import DashboardView from './components/DashboardView'
import Menu from './components/Menu'
import { defaultSettings } from './lib/raceCode'
import { LEVELS } from '@dsh-math-tutor/math-generator/core'
import { loadProfile, saveProfile, saveSession } from './lib/storage'
import type { LearnerProfile, RaceSettings, SessionRecord, View } from './lib/types'
import { gradeSession, type Question } from '@dsh-math-tutor/math-generator/core'
import { accumulateSession, adaptiveCarryRatio } from './lib/profile'
import { battleScore } from './api/battle'
import { recordStars, starsFor } from './lib/adventure'
import { earnedIds, diffBadges, type Badge } from './lib/badges'
import { submitScore, type ScoreResult } from './lib/score'
import { bumpMetric } from './lib/profile'
import './styles.css'

export default function App() {
  const [profile, setProfile] = useState<LearnerProfile | null>(() => loadProfile())
  // 访客试玩：无档案也可直接体验每日挑战，全程不落库/不上传
  const [guest, setGuest] = useState(false)
  const [view, setView] = useState<View>('map')
  const [settings, setSettings] = useState<RaceSettings>(defaultSettings())
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [newBadges, setNewBadges] = useState<Badge[]>([])
  const [raceKey, setRaceKey] = useState(0)
  const badgesBeforeRef = useRef<Set<string>>(new Set())

  if (!profile && !guest) {
    return (
      <div className="page">
        <OnboardingView
          onDone={(p) => { saveProfile(p); setProfile(p) }}
          onTry={() => setGuest(true)}
        />
      </div>
    )
  }

  // 试玩期间的内存虚拟档案：昵称只用于展示，绝不写入 localStorage/服务器
  const GUEST_PROFILE: LearnerProfile = {
    nickname: '小勇士', gender: 'secret', age: 8, grade: 2,
    subjects: ['math', 'chinese', 'english'], createdAt: '',
  }
  const me = profile ?? GUEST_PROFILE

  const startRace = (s: RaceSettings) => {
    // 练习前快照：结算时 diff 出本次新获得的勋章
    if (!guest) badgesBeforeRef.current = earnedIds()
    // 画像反哺出题：仅个人日常练习启用；竞赛码导入/错题重练锁定参数
    if (!guest && !s.imported && !s.customQuestions) {
      const { ratio, applied, reason } = adaptiveCarryRatio(LEVELS[s.level].carryRatio)
      if (applied) s = { ...s, carryRatio: ratio, adaptiveReason: reason }
    }
    if (!guest && s.adaptiveReason) bumpMetric('adaptShown')   // 画像反哺生效埋点
    setSettings(s)
    setRaceKey((k) => k + 1)
    setView('race')
  }

  const startMistakeRetry = (questions: Question[]) => {
    startRace({
      ...settings,
      count: questions.length,
      durationSec: Math.max(60, questions.length * 5),  // 每题 5 秒，至少 1 分钟
      customQuestions: questions,
    })
  }

  const handleFinish = (r: {
    answers: Array<number | string | null>
    perQuestionMs: number[]
    usedMs: number
    finishedBy: 'submit' | 'timeout'
    questions: Question[]
  }) => {
    const graded = gradeSession(r.questions, r.answers, r.perQuestionMs)
    const rec: SessionRecord = {
      id: `${Date.now()}-${settings.seed}`,
      owner: me.nickname,
      date: new Date().toISOString(),
      settings,
      usedMs: r.usedMs,
      total: graded.total,
      answered: graded.answered,
      correct: graded.correct,
      accuracy: graded.accuracy,
      perQuestionMs: graded.perQuestionMs,
      wrong: graded.wrongIndexes.map((i) => ({ question: r.questions[i], given: r.answers[i] ?? null })),
      finishedBy: r.finishedBy,
    }
    if (!guest) {
      saveSession(rec)
      // 反哺命中：自适应生效且本次正确率达标（≥85%）
      if (settings.adaptiveReason && graded.correct / Math.max(graded.total, 1) >= 0.85) bumpMetric('adaptHit')
      accumulateSession(r.questions, graded.wrongIndexes, r.answers)  // 画像积累（确定性统计）
      battleScore(settings, me.nickname, graded.correct, graded.answered, r.usedMs)  // 交卷上报
      // 积分上报：仅开启云端同步时参与（异步不阻塞结算页展示）
      submitScore({
        nickname: me.nickname,
        mode: settings.mode,
        level: settings.level,
        total: graded.total,
        correct: graded.correct,
      }).then((sr) => setScoreResult(sr))
      const stars = starsFor(graded.correct, graded.total)
      if (settings.stageId) recordStars(settings.stageId, stars)
      if (settings.daily) recordStars(new Date().toISOString().slice(0, 10), stars, true)
    } else {
      setScoreResult(null)
    }
    setRecord(rec)
    // 勋章 diff：本次练习后新获得的（recordStars/saveSession 已先落库，此刻 earnedIds 反映最新状态）
    if (!guest) {
      const after = earnedIds()
      setNewBadges(diffBadges(badgesBeforeRef.current, after))
    } else {
      setNewBadges([])
    }
    setView('result')
  }

  const navigate = (v: View) => setView(v)

  return (
    <div className="page">
      {view !== 'race' && <Menu current={view} onNavigate={navigate} />}
      {view === 'map' && (
        <MapView
          profile={me}
          onStartStage={startRace}
          onFreePractice={() => setView('setup')}
        />
      )}
      {view === 'setup' && (
        <SetupView
          profile={me}
          settings={settings}
          onChange={setSettings}
          onStart={() => startRace(settings)}
          onOpenMistakes={() => setView('mistakes')}
          newBadges={newBadges}
        />
      )}
      {view === 'race' && settings.kind === 'match' && <WordMatchView key={raceKey} settings={settings} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'race' && settings.kind === 'poemchain' && <PoemChainView key={raceKey} settings={settings} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'race' && settings.kind === 'snake' && <SnakeView key={raceKey} settings={settings} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'race' && settings.kind === 'whack' && <WhackView key={raceKey} settings={settings} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'race' && settings.kind === 'memory' && <MemoryView key={raceKey} settings={settings} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'race' && !['match', 'poemchain', 'snake', 'whack', 'memory'].includes(settings.kind ?? '') && <RaceView key={raceKey} settings={settings} nickname={me.nickname} grade={me.grade} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'result' && record && (
        <ResultView
          record={record}
          profile={me}
          scoreResult={scoreResult}
          guest={guest}
          onRetry={startRace}
          onHome={() => setView('map')}
          onOpenMistakes={() => setView('mistakes')}
        />
      )}
      {view === 'mistakes' && <MistakeBook onBack={() => setView('map')} onRetryMistakes={startMistakeRetry} />}
      {view === 'dashboard' && <DashboardView onRetryMistakes={startMistakeRetry} />}
    </div>
  )
}
