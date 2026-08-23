import { useState } from 'react'
import OnboardingView from './components/OnboardingView'
import SetupView from './components/SetupView'
import RaceView from './components/RaceView'
import ResultView from './components/ResultView'
import MistakeBook from './components/MistakeBook'
import { defaultSettings } from './lib/raceCode'
import { loadProfile, saveProfile, saveSession } from './lib/storage'
import type { LearnerProfile, RaceSettings, SessionRecord, View } from './lib/types'
import { gradeSession, type Question } from '@dsh-math-tutor/math-generator/core'
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
    setSettings(s)
    setRaceKey((k) => k + 1)
    setView('race')
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
    setRecord(rec)
    setView('result')
  }

  return (
    <div className="page">
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
          onRetry={startRace}
          onHome={() => setView('setup')}
          onOpenMistakes={() => setView('mistakes')}
        />
      )}
      {view === 'mistakes' && <MistakeBook onBack={() => setView('setup')} />}
    </div>
  )
}
