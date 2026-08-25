// 寻宝探险 · 卷轴地图（kage 启发：多层剪影 + 滚动视差 + 光影氛围）
// 零资源实现：SVG 程序化山脊剪影 × 3 景深层，滚动时差速移动
import { useEffect, useMemo, useRef, useState } from 'react'
import { STAGES, SUBJECTS, currentSubject, setSubject, stagesOf, isUnlocked, loadAdventure, consumeUnlock, recommendStage, petStage, titleFor, totalStars, dailySettings, todayKey } from '../lib/adventure'
import { loadProfileData } from '../lib/profile'
import { dominantAdvice } from '../lib/errorPatterns'
import Sprite from './Sprite'
import { sfx } from '../lib/sound'
import TreasureMapBg from './TreasureMapBg'
import ParticleField from './ParticleField'
import type { LearnerProfile, RaceSettings } from '../lib/types'

interface SceneTheme {
  sky: [string, string, string]   // 上中下三段天空渐变
  layers: [string, string, string] // 远/中/近景剪影色
  glow: string                     // 光晕色（灯笼/萤火氛围）
  emoji: string
}

const SUBJECT_LABEL: Record<string, string> = { math: '数学', chinese: '语文', english: '英语' }

// 已生成静帧插画的关卡（public/stages/<id>.webp）：有图则替换程序化 SVG 场景
const STAGE_ART = new Set([
  // 数学大陆 16 关
  'forest', 'cave', 'lake', 'snow', 'island', 'vine', 'bamboo', 'falls', 'thunder', 'temple',
  'meadow', 'desert', 'volcano', 'rainbow', 'galaxy', 'moon',
  // 语文大陆 12 关
  'chi-nature', 'chi-school', 'chi-tree', 'chi-home', 'chi-story', 'chi-mist',
  'chi-snow', 'chi-fox', 'chi-boat', 'chi-poem', 'chi-char1', 'chi-char2',
  // 英语大陆 16 关
  'eng-letters1', 'eng-letters2', 'eng-greet', 'eng-school', 'eng-body', 'eng-color',
  'eng-animal', 'eng-food', 'eng-family', 'eng-toy', 'eng-clothes', 'eng-weather',
  'eng-number', 'eng-action', 'eng-opp', 'eng-sentence',
])

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
  meadow:  { sky: ['#3a6ea5', '#7fb3d5', '#c9e4f5'], layers: ['#5a8fc0', '#3b6a99', '#234a70'], glow: '#e8f4ff', emoji: '🌤️' },
  desert:  { sky: ['#b8651e', '#e0984a', '#f2c98a'], layers: ['#c98a4a', '#9a6428', '#6b4212'], glow: '#ffe4b0', emoji: '🏜️' },
  volcano: { sky: ['#3d0c0c', '#8a2a1e', '#e0662a'], layers: ['#a83a24', '#5c1a10', '#330d07'], glow: '#ffb38a', emoji: '🌋' },
  rainbow: { sky: ['#7a4a9e', '#c96a9e', '#f2a56a'], layers: ['#9a5a8e', '#6b3a72', '#3f2148'], glow: '#ffd6f5', emoji: '🌈' },
  galaxy:  { sky: ['#0b1026', '#232a52', '#4a5a9e'], layers: ['#323a6b', '#1c2145', '#0e1129'], glow: '#c9d6ff', emoji: '🌌' },
  moon:    { sky: ['#1c1f26', '#3a4048', '#6b7480'], layers: ['#4a525c', '#2c323a', '#161a20'], glow: '#f5f0d0', emoji: '🌙' },
  'eng-letters1': { sky: ['#2a6a8a', '#52b6c9', '#a5e8f0'], layers: ['#3a8aa8', '#1e5a75', '#0f3a50'], glow: '#fff3b0', emoji: '🏖️' },
  'eng-letters2': { sky: ['#4a5a75', '#7a8aa5', '#b8c4d8'], layers: ['#5c6c88', '#3a4763', '#202a42'], glow: '#e8f0ff', emoji: '🪨' },
  'eng-greet':    { sky: ['#b85c1e', '#e8984a', '#f2d06a'], layers: ['#c97a3a', '#8a5222', '#5c3410'], glow: '#ffe8b0', emoji: '🗼' },
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

// 场景辨识元素：每关独有的剪影（钟乳石/廊柱/缆索/竹林）
function Landmarks({ stageId, color }: { stageId: string; color: string }) {
  if (stageId === 'cave') {
    return (
      <>
        {[40, 120, 210, 300, 370].map((x, i) => (
          <polygon key={i} points={`${x},0 ${x + 14},0 ${x + 7},${22 + (i % 3) * 10}`} fill={color} />
        ))}
      </>
    )
  }
  if (stageId === 'temple') {
    return (
      <>
        <rect x="120" y="20" width="160" height="8" fill={color} />
        <rect x="150" y="28" width="10" height="50" fill={color} />
        <rect x="240" y="28" width="10" height="50" fill={color} />
        <polygon points="110,20 290,20 200,2" fill={color} />
      </>
    )
  }
  if (stageId === 'thunder') {
    return <polyline points="60,90 180,10 340,85" stroke={color} strokeWidth="2" fill="none" opacity="0.7" />
  }
  if (stageId === 'bamboo') {
    return (
      <>
        {[60, 90, 150, 260, 320].map((x, i) => (
          <rect key={i} x={x} y={30 + (i % 2) * 8} width="5" height="60" fill={color} opacity="0.8" />
        ))}
      </>
    )
  }
  if (stageId === 'falls') {
    return (
      <>
        {[140, 200, 260].map((x, i) => (
          <line key={i} x1={x} y1="30" x2={x} y2="90" stroke="#caf0f8" strokeWidth="3" opacity="0.35" />
        ))}
      </>
    )
  }
  if (stageId === 'forest' || stageId === 'vine') {
    return (
      <>
        {[50, 130, 230, 330].map((x, i) => (
          <polygon key={i} points={`${x},70 ${x + 9},70 ${x + 4.5},${44 + (i % 2) * 8}`} fill={color} opacity="0.85" />
        ))}
      </>
    )
  }
  if (stageId === 'snow') {
    return (
      <>
        <polygon points="90,42 118,10 146,42" fill="#ffffff" opacity="0.85" />
        <polygon points="230,50 262,14 294,50" fill="#ffffff" opacity="0.7" />
      </>
    )
  }
  if (stageId === 'lake' || stageId === 'island') {
    return (
      <>
        {[80, 190, 300].map((x, i) => (
          <ellipse key={i} cx={x} cy={86 - (i % 2) * 4} rx="26" ry="4" fill="#ffffff" opacity="0.18" />
        ))}
      </>
    )
  }
  return null
}

function SceneLayers({ stageId }: { stageId: string }) {
  const t = SCENES[stageId] ?? SCENES.forest
  return (
    <>
      <svg className="layer far" data-speed="0.15" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden>
        <path d={ridge(stageId.length * 7 + 3, 55, 18)} fill={t.layers[0]} opacity="0.8" />
        <Landmarks stageId={stageId} color={t.layers[1]} />
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


// 关卡插画：public/stages/<id>.jpg 存在则显示（离线生成的 AI 插画），缺失则透明回退
function StageArt({ stageId }: { stageId: string }) {
  const url = `${import.meta.env.BASE_URL}stages/${stageId}.jpg`
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setOk(true)
    img.src = url
  }, [url])
  if (!ok) return null
  return <div className="stage-art" style={{ backgroundImage: `url(${url})` }} />
}

export default function AdventureMap({ profile, onStartStage, onFreePractice }: Props) {
  const [subject, setSub] = useState(currentSubject())
  const adv = loadAdventure()
  const stars = totalStars(adv)
  const pet = petStage(stars)
  const dailyDone = (adv.daily[todayKey()] ?? 0) > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [unlockFx, setUnlockFx] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)   // rail 导航：-1=Hero，0..=关卡索引
  const [showTop, setShowTop] = useState(false)

  // 空闲时预取当前科目全部关卡图（滚动到即已缓存，翻屏零白屏）
  useEffect(() => {
    let alive = true
    const prefetch = () => {
      if (!alive) return
      stagesOf(subject).forEach((st) => {
        if (STAGE_ART.has(st.id)) {
          const im = new Image()
          im.src = `${import.meta.env.BASE_URL}stages/${st.id}.webp`
        }
      })
    }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    const id = ric ? ric(prefetch) : window.setTimeout(prefetch, 2000)
    return () => { alive = false; if (!ric) clearTimeout(id) }
  }, [subject])

  // rail 当前屏追踪 + 返回顶部按钮显隐
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setShowTop(el.scrollTop > el.clientHeight * 0.6)
        const scenes = el.querySelectorAll<HTMLElement>('.scene')
        const mid = el.scrollTop + el.clientHeight / 2
        let cur = -1
        scenes.forEach((s, j) => { if (s.offsetTop <= mid) cur = j })
        setActiveIdx(cur)
      })
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [subject])

  const scrollToIdx = (j: number) => {
    const el = scrollRef.current
    if (!el) return
    const top = j < 0 ? 0 : el.querySelectorAll<HTMLElement>('.scene')[j]?.offsetTop ?? 0
    el.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
  }

  // 解锁仪式：回到地图时若有新解锁关卡，滚动到它并播放光晕脉冲
  useEffect(() => {
    const id = consumeUnlock()
    if (!id) return
    setUnlockFx(id)
    sfx.win()
    const el = scrollRef.current
    const scene = el?.querySelector<HTMLElement>(`[data-stage="${id}"]`)
    if (el && scene) el.scrollTo({ top: scene.offsetTop - el.clientHeight / 4, behavior: reduced ? 'auto' : 'smooth' })
    const t = setTimeout(() => setUnlockFx(null), 2600)
    return () => clearTimeout(t)
  }, [reduced])

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
    // 视口尺寸变化（横竖屏切换/窗口拖拽/地址栏伸缩）时重算视差
    const ro = new ResizeObserver(() => onScroll())
    ro.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [reduced])

  const stageSettings = (i: number): RaceSettings => {
    const st = stagesOf(subject)[i]
    return {
      mode: 'G2A', count: st.count, durationSec: st.durationSec, level: st.level,
      ops: st.ops, max: st.max, domain: st.domain, kind: st.kind,
      subject: st.subject ?? 'math',
      seed: Math.floor(Math.random() * 1e9), stageId: st.id,
    }
  }
  const recommend = recommendStage(adv)

  // 主动性：画像驱动"今日建议"气泡（打开地图时小精灵主动开口）
  const todayAdvice = (() => {
    const pd = loadProfileData()
    const tip = dominantAdvice(pd.patterns)
    const dailyCount = Object.keys(adv.daily).length
    if (tip) return `今天开始之前：${tip}`
    if (dailyCount > 0 && !dailyDone) return '今天还没打卡每日挑战哦，完成后有加分奖励！'
    if (recommend) return `我看好你哦～${recommend.reason}`
    return null
  })()

  return (
    <div className="adventure" ref={scrollRef}>
      {/* 顶部信息栏（随卷轴滚动） */}
      <header className="adv-hero parchment">
        <TreasureMapBg />
        <ParticleField />
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
          onClick={() => onStartStage({ mode: 'G2A', max: 100, imported: true, daily: true, ...dailySettings() })}
        >
          🌞 每日挑战 · 今日{SUBJECT_LABEL[dailySettings().subject ?? 'math']}{dailyDone ? ' ✅' : ''}
        </button>
        {recommend && (
          <button className="recommend" onClick={() => {
            const stages = [...STAGES, ...stagesOf('english'), ...stagesOf('chinese')]
            const idx = stages.findIndex((x) => x.id === recommend.stage.id)
            if (idx >= 0) {
              const sub2 = recommend.stage.subject ?? 'math'
              setSubject(sub2); setSub(sub2)
              const all = stagesOf(sub2)
              const i2 = all.findIndex((x) => x.id === recommend.stage.id)
              onStartStage({
                mode: 'G2A', count: all[i2].count, durationSec: all[i2].durationSec, level: all[i2].level,
                ops: all[i2].ops, max: all[i2].max, domain: all[i2].domain, kind: all[i2].kind,
                seed: Math.floor(Math.random() * 1e9), stageId: all[i2].id,
              })
            }
          }}>
            🧭 推荐：{recommend.reason} →
          </button>
        )}
        <div className="continents">
          {SUBJECTS.map((sub) => (
            <button
              key={sub.id}
              className={`continent land-${sub.id}${sub.id === subject ? ' active' : ''}`}
              onClick={() => {
                setSubject(sub.id); setSub(sub.id)
                // 跳到该大陆最新可参与关：解锁链上最后一个未满星的关卡
                const stages = stagesOf(sub.id)
                let target = stages[0]
                for (let j = 0; j < stages.length; j++) {
                  if (!isUnlocked(j, adv, stages)) break
                  target = stages[j]
                  if ((adv.stars[stages[j].id] ?? 0) >= 3) continue  // 满星继续往后找
                  break
                }
                requestAnimationFrame(() => {
                  const el = scrollRef.current
                  const scene = el?.querySelector<HTMLElement>(`[data-stage="${target.id}"]`)
                  if (el && scene) el.scrollTo({ top: scene.offsetTop - el.clientHeight / 4, behavior: reduced ? 'auto' : 'smooth' })
                })
              }}
            >
              <span className="continent-emoji">{sub.emoji}</span>
              <b>{sub.name}</b>
              <small>{sub.desc}</small>
              {sub.comingSoon && <span className="soon">即将开放</span>}
            </button>
          ))}
        </div>
        <p className="adv-sub">向下滚动，开始你的旅程 ↓</p>
      </header>


      {/* 卷轴关卡 */}
      {stagesOf(subject).map((st, i) => {
        const unlocked = isUnlocked(i, adv, stagesOf(subject))
        const got = adv.stars[st.id] ?? 0
        const t = SCENES[st.id] ?? SCENES.forest
        return (
          <section
            key={st.id}
            data-stage={st.id}
            className={`scene${unlocked ? '' : ' locked'}${unlockFx === st.id ? ' unlock-fx' : ''}`}
            style={{ background: `linear-gradient(180deg, ${t.sky[0]}, ${t.sky[1]} 55%, ${t.sky[2]})` }}
          >
            {/* 光晕（已解锁关的灯笼光/萤火） */}
            {STAGE_ART.has(st.id) ? (
              <img
                className="scene-art"
                src={`${import.meta.env.BASE_URL}stages/${st.id}.webp`}
                loading={i <= 1 ? 'eager' : 'lazy'}
                decoding="async"
                alt="" aria-hidden
              />
            ) : (
              <>
                {unlocked && <div className="scene-glow" style={{ background: `radial-gradient(circle at 50% 42%, ${t.glow}33, transparent 60%)` }} />}
                <SceneLayers stageId={st.id} />
                <StageArt stageId={st.id} />
              </>
            )}

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

      {/* 章节圆点 rail：当前屏高亮，点击直达 */}
      <nav className="rail" aria-label="关卡导航">
        <button className={activeIdx < 0 ? 'on' : ''} onClick={() => scrollToIdx(-1)} aria-label="返回首页" />
        {stagesOf(subject).map((st, j) => (
          <button key={st.id} className={activeIdx === j ? 'on' : ''} onClick={() => scrollToIdx(j)} aria-label={st.name} />
        ))}
      </nav>

      {/* 返回首页上箭头（避开右下角智能助手，放右中） */}
      {showTop && (
        <button className="to-top" onClick={() => scrollToIdx(-1)} aria-label="回到顶部">↑</button>
      )}

      {/* 主动性：小精灵画像驱动今日建议（无画像数据时不显示） */}
      {todayAdvice && <Sprite grade={profile.grade} bubble={todayAdvice} />}
    </div>
  )
}
