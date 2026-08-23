import StageArt from './StageArt'
import { STAGES, isUnlocked, loadAdventure, petStage, titleFor, totalStars, dailySettings, todayKey } from '../lib/adventure'
import type { LearnerProfile, RaceSettings } from '../lib/types'

interface Props {
  profile: LearnerProfile
  onStartStage: (s: RaceSettings) => void
  onFreePractice: () => void
}

export default function MapView({ profile, onStartStage, onFreePractice }: Props) {
  const adv = loadAdventure()
  const stars = totalStars(adv)
  const pet = petStage(stars)
  const dailyDone = (adv.daily[todayKey()] ?? 0) > 0

  const stageSettings = (i: number): RaceSettings => {
    const st = STAGES[i]
    return {
      mode: 'G2A', count: st.count, durationSec: st.durationSec, level: st.level,
      ops: st.ops, max: 100, seed: Math.floor(Math.random() * 1e9), stageId: st.id,
    }
  }

  return (
    <div className="card wide">
      <div className="map-header">
        <h1>🗺️ 寻宝探险</h1>
        <div className="pet-row">
          <span className="pet">{pet.emoji}</span>
          <div>
            <b>{profile.nickname} · {titleFor(stars)}</b>
            <p className="subtitle">
              {pet.name} · ⭐ {stars}
              {pet.next ? ` · 还差 ${pet.next.min - stars} 星进化` : ' · 已完全进化！'}
            </p>
          </div>
        </div>
      </div>

      <button
        className={dailyDone ? 'daily done' : 'daily'}
        onClick={() => onStartStage({ mode: 'G2A', max: 100, imported: true, daily: true, ...dailySettings() })}
      >
        🌞 每日挑战（30题 · 3分钟）{dailyDone ? ' ✅ 今日已完成' : ' · 全班同题！'}
      </button>

      <div className="stages">
        {STAGES.map((st, i) => {
          const unlocked = isUnlocked(i, adv)
          const got = adv.stars[st.id] ?? 0
          return (
            <button
              key={st.id}
              className={unlocked ? 'stage open' : 'stage locked'}
              disabled={!unlocked}
              onClick={() => onStartStage(stageSettings(i))}
            >
              {unlocked && (
                <div className="stage-art"><StageArt stageId={st.id} height={64} /></div>
              )}
              <div className="stage-row">
                {!unlocked && <span className="stage-emoji">🔒</span>}
                <span className="stage-info">
                  <b>第{i + 1}关 · {st.name}</b>
                  <small>{st.desc}</small>
                </span>
                <span className="stage-stars">
                  {'⭐'.repeat(got)}{'☆'.repeat(3 - got)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <button className="ghost" onClick={onFreePractice}>⚙️ 自由练习（家长设置）</button>
    </div>
  )
}
