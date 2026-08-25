import { useState } from 'react'
import OnboardingView from './components/OnboardingView'
import SetupView from './components/SetupView'
import MapView from './components/AdventureMap'
import RaceView from './components/RaceView'
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
import { submitScore, type ScoreResult } from './lib/score'
import './styles.css'

export default function App() {
  const [profile, setProfile] = useState<LearnerProfile | null>(() => loadProfile())
  const [view, setView] = useState<View>('map')
  const [settings, setSettings] = useState<RaceSettings>(defaultSettings())
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [raceKey, setRaceKey] = useState(0)

  if (!profile) {
    return (
      <div className="page">
        <OnboardingView onDone={(p) => { saveProfile(p); setProfile(p) }} />
      </div>
    )
  }

  const startRace = (s: RaceSettings) => {
    // 画像反哺出题：仅个人日常练习启用；竞赛码导入/错题重练锁定参数
    if (!s.imported && !s.customQuestions) {
      const { ratio, applied, reason } = adaptiveCarryRatio(LEVELS[s.level].carryRatio)
      if (applied) s = { ...s, carryRatio: ratio, adaptiveReason: reason }
    }
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
      owner: profile.nickname,
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
    saveSession(rec)
    accumulateSession(r.questions, graded.wrongIndexes, r.answers)  // 画像积累（确定性统计）
    battleScore(settings, profile.nickname, graded.correct, graded.answered, r.usedMs)  // 交卷上报
    // 积分上报：仅开启云端同步时参与（异步不阻塞结算页展示）
    submitScore({
      nickname: profile.nickname,
      mode: settings.mode,
      level: settings.level,
      total: graded.total,
      correct: graded.correct,
    }).then((sr) => setScoreResult(sr))
    const stars = starsFor(graded.correct, graded.total)
    if (settings.stageId) recordStars(settings.stageId, stars)
    if (settings.daily) recordStars(new Date().toISOString().slice(0, 10), stars, true)
    setRecord(rec)
    setView('result')
  }

  const navigate = (v: View) => setView(v)

  return (
    <div className="page">
      {view !== 'race' && <Menu current={view} onNavigate={navigate} />}
      {view === 'map' && (
        <MapView
          profile={profile}
          onStartStage={startRace}
          onFreePractice={() => setView('setup')}
        />
      )}
      {view === 'setup' && (
        <SetupView
          profile={profile}
          settings={settings}
          onChange={setSettings}
          onStart={() => startRace(settings)}
          onOpenMistakes={() => setView('mistakes')}
        />
      )}
      {view === 'race' && <RaceView key={raceKey} settings={settings} nickname={profile.nickname} grade={profile.grade} onAbandon={() => setView('map')} onFinish={handleFinish} />}
      {view === 'result' && record && (
        <ResultView
          record={record}
          profile={profile}
          scoreResult={scoreResult}
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
