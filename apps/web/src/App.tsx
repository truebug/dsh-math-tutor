import { useState } from 'react'
import OnboardingView from './components/OnboardingView'
import SetupView from './components/SetupView'
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
import './styles.css'

export default function App() {
  const [profile, setProfile] = useState<LearnerProfile | null>(() => loadProfile())
  const [view, setView] = useState<View>('setup')
  const [settings, setSettings] = useState<RaceSettings>(defaultSettings())
  const [record, setRecord] = useState<SessionRecord | null>(null)
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
    answers: Array<number | null>
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
    accumulateSession(r.questions, graded.wrongIndexes)  // 画像积累（确定性统计）
    setRecord(rec)
    setView('result')
  }

  const navigate = (v: View) => setView(v)

  return (
    <div className="page">
      {view !== 'race' && <Menu current={view} onNavigate={navigate} />}
      {view === 'setup' && (
        <SetupView
          profile={profile}
          settings={settings}
          onChange={setSettings}
          onStart={() => startRace(settings)}
          onOpenMistakes={() => setView('mistakes')}
        />
      )}
      {view === 'race' && <RaceView key={raceKey} settings={settings} onFinish={handleFinish} />}
      {view === 'result' && record && (
        <ResultView
          record={record}
          profile={profile}
          onRetry={startRace}
          onHome={() => setView('setup')}
          onOpenMistakes={() => setView('mistakes')}
        />
      )}
      {view === 'mistakes' && <MistakeBook onBack={() => setView('setup')} onRetryMistakes={startMistakeRetry} />}
      {view === 'dashboard' && <DashboardView />}
    </div>
  )
}
