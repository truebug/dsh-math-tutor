// 寻宝探险 · 卷轴地图（kage 启发：多层剪影 + 滚动视差 + 光影氛围）
// 零资源实现：SVG 程序化山脊剪影 × 3 景深层，滚动时差速移动
import { useEffect, useMemo, useRef, useState } from 'react'
import { STAGES, isUnlocked, loadAdventure, petStage, titleFor, totalStars, dailySettings, todayKey } from '../lib/adventure'
import type { LearnerProfile, RaceSettings } from '../lib/types'

interface SceneTheme {
  sky: [string, string, string]   // 上中下三段天空渐变
  layers: [string, string, string] // 远/中/近景剪影色
  glow: string                     // 光晕色（灯笼/萤火氛围）
  emoji: string
}

const SCENES: Record<string, SceneTheme> = {
  forest:  { sky: ['#0d2818', '#1d4a3a', '#3a7a55'], layers: ['#2e6b4f', '#1a4534', '#0c2418'], glow: '#ffe08a', emoji: '🌲' },
  cave:    { sky: ['#101223', '#2b2d42', '#4a4e6d'], layers: ['#3a3d5c', '#23243a', '#12131f'], glow: '#8ab6ff', emoji: '🕳️' },
  lake:    { sky: ['#0f3d52', '#1a5f7a', '#2a8a9e'], layers: ['#2a7a96', '#14506b', '#082838'], glow: '#a5f3fc', emoji: '💧' },
  snow:    { sky: ['#33507a', '#4a6fa5', '#8fa8c9'], layers: ['#5c7bab', '#3a5583', '#22334f'], glow: '#ffffff', emoji: '🏔️' },
  island:  { sky: ['#b85c1e', '#f2994a', '#f2c94c'], layers: ['#d18a3a', '#a06428', '#6e4214'], glow: '#ffd76a', emoji: '🏝️' },
  vine:    { sky: ['#1b4332', '#2d6a4f', '#52b788'], layers: ['#40916c', '#1e5238', '#0d2b1d'], glow: '#d8f3a5', emoji: '🌿' },
  bamboo:  { sky: ['#3a4623', '#606c38', '#a3b18a'], layers: ['#7a8a56', '#4a562e', '#2a3319'], glow: '#fefae0', emoji: '🎋' },
  falls:   { sky: ['#0e5a75', '#168aad', '#52c7d8'], layers: ['#2a97b8', '#0f6a8a', '#073f52'], glow: '#caf0f8', emoji: '🌊' },
  thunder: { sky: ['#1a1745', '#3d348b', '#6c63c9'], layers: ['#5246a3', '#2e2766', '#171240'], glow: '#c4b5fd', emoji: '⛰️' },
  temple:  { sky: ['#6e5705', '#9a7b0a', '#e0b93a'], layers: ['#b8942a', '#7d6308', '#4a3c04'], glow: '#fff3b0', emoji: '🏆' },
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 种子化山脊线：同一场景每次渲染一致
function ridge(seed: number, baseY: number, amp: number, width = 400, height = 100): string {
  const r = rng(seed)
  const pts: string[] = [`M0 ${height}`]
  const n = 7
  for (let i = 0; i <= n; i += 1) {
    pts.push(`L${(i / n) * width} ${baseY + (r() - 0.5) * 2 * amp}`)
  }
  pts.push(`L${width} ${height} Z`)
  return pts.join(' ')
}

function SceneLayers({ stageId }: { stageId: string }) {
  const t = SCENES[stageId] ?? SCENES.forest
  return (
    <>
      <svg className="layer far" data-speed="0.15" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d={ridge(stageId.length * 7 + 3, 55, 18)} fill={t.layers[0]} opacity="0.8" />
      </svg>
      <svg className="layer mid" data-speed="0.35" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d={ridge(stageId.length * 13 + 5, 68, 14)} fill={t.layers[1]} />
      </svg>
      <svg className="layer near" data-speed="0.6" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d={ridge(stageId.length * 23 + 11, 80, 10)} fill={t.layers[2]} />
      </svg>
    </>
  )
}

interface Props {
  profile: LearnerProfile
  onStartStage: (s: RaceSettings) => void
  onFreePractice: () => void
}

export default function AdventureMap({ profile, onStartStage, onFreePractice }: Props) {
  const adv = loadAdventure()
  const stars = totalStars(adv)
  const pet = petStage(stars)
  const dailyDone = (adv.daily[todayKey()] ?? 0) > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // 滚动视差：各景深层按 data-speed 差速移动
  useEffect(() => {
    if (reduced) return
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const apply = () => {
      const vh = el.clientHeight
      el.querySelectorAll<HTMLElement>('.scene').forEach((scene) => {
        const off = scene.offsetTop - el.scrollTop
        const progress = (off - vh / 2) / vh   // -1..1 场景相对视口中心的位置
        scene.querySelectorAll<HTMLElement>('.layer').forEach((layer) => {
          const speed = Number(layer.dataset.speed ?? 0.3)
          layer.style.transform = `translateY(${progress * speed * 90}px)`
        })
        const glow = scene.querySelector<HTMLElement>('.scene-glow')
        if (glow) glow.style.opacity = String(Math.max(0, 1 - Math.abs(progress) * 1.6))
      })
    }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply) }
    apply()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [reduced])

  const stageSettings = (i: number): RaceSettings => {
    const st = STAGES[i]
    return {
      mode: 'G2A', count: st.count, durationSec: st.durationSec, level: st.level,
      ops: st.ops, max: 81, seed: Math.floor(Math.random() * 1e9), stageId: st.id,
    }
  }

  return (
    <div className="adventure" ref={scrollRef}>
      {/* 顶部信息栏（随卷轴滚动） */}
      <header className="adv-hero">
        <h1>🗺️ 寻宝探险</h1>
        <div className="pet-row">
          <span className="pet">{pet.emoji}</span>
          <div>
            <b>{profile.nickname} · {titleFor(stars)}</b>
            <p className="adv-sub">
              {pet.name} · ⭐ {stars}{pet.next ? ` · 还差 ${pet.next.min - stars} 星进化` : ''}
            </p>
          </div>
        </div>
        <button
          className={dailyDone ? 'daily done' : 'daily'}
          onClick={() => onStartStage({ mode: 'G2A', max: 81, imported: true, daily: true, ...dailySettings() })}
        >
          🌞 每日挑战{dailyDone ? ' ✅ 今日已完成' : ' · 全班同题！'}
        </button>
        <p className="adv-sub">向下滚动，开始你的旅程 ↓</p>
      </header>

      {/* 卷轴关卡 */}
      {STAGES.map((st, i) => {
        const unlocked = isUnlocked(i, adv)
        const got = adv.stars[st.id] ?? 0
        const t = SCENES[st.id] ?? SCENES.forest
        return (
          <section
            key={st.id}
            className={unlocked ? 'scene' : 'scene locked'}
            style={{ background: `linear-gradient(180deg, ${t.sky[0]}, ${t.sky[1]} 55%, ${t.sky[2]})` }}
          >
            {/* 光晕（已解锁关的灯笼光/萤火） */}
            {unlocked && <div className="scene-glow" style={{ background: `radial-gradient(circle at 50% 42%, ${t.glow}33, transparent 60%)` }} />}
            <SceneLayers stageId={st.id} />

            <div className="scene-node" style={{ justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
              <button
                className={unlocked ? 'node' : 'node locked'}
                disabled={!unlocked}
                onClick={() => onStartStage(stageSettings(i))}
              >
                <span className="node-emoji">{unlocked ? t.emoji : '🔒'}</span>
                <span className="node-label">
                  <b>第{i + 1}关 · {st.name}</b>
                  <small>{st.desc}</small>
                  <span className="node-stars">{'⭐'.repeat(got)}{'☆'.repeat(3 - got)}</span>
                </span>
              </button>
            </div>
          </section>
        )
      })}

      <footer className="adv-foot">
        <button className="ghost light" onClick={onFreePractice}>⚙️ 自由练习（家长设置）</button>
      </footer>
    </div>
  )
}
