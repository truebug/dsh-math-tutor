// 「核电站主控实践」反应堆模拟关卡：孩子扮演主控操作员，完成任务单
// 纯前端确定性物理简化模型（出题判分红线：零 LLM），Canvas 2D 堆芯动画实时反馈
// 设计：docs 见 HANDOFF/progress；与「逃离切尔诺贝利」组成叙事二部曲（先学操控，再面对事故）
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import type { RaceSettings } from '../lib/types'
import {
  SAFE_TEMP, SAFE_PRESSURE, MELTDOWN_TEMP,
  GROUPS, ROD_RATE, AUTO_RATE, SCRAM_RATE, AUTO_KP,
  rodEffect, equilibriumState, stepReactor,
  type ReactorState,
} from '../lib/reactorPhysics'

interface Props {
  settings: RaceSettings
  onAbandon: () => void
  onFinish: (r: { answers: Array<number | string | null>; perQuestionMs: number[]; usedMs: number; finishedBy: 'submit' | 'timeout' | 'fail'; questions: Question[] }) => void
}


// ===== 任务定义 =====
interface Task {
  name: string
  desc: string
  check: (s: ReactorState, elapsed: number) => 'doing' | 'done' | 'fail'
  startPower?: number     // 任务开始时反应堆状态重置到此功率（衔接过渡）
  failMsg: string
}
// hold 判定用真实秒数累积（dt 驱动），不按帧数——避免高刷新率设备任务过易
function holdTask(target: { lo: number; hi: number }, holdSec: number, timeoutSec: number, overLimit = 105) {
  let held = 0
  let lastT: number | null = null
  return (s: ReactorState, el: number) => {
    if (s.power > overLimit) return 'fail'
    if (lastT !== null) {
      const dt = Math.max(0, el - lastT)
      if (s.power >= target.lo && s.power <= target.hi) held += dt
      else held = 0
    }
    lastT = el
    return held >= holdSec ? 'done' : (el > timeoutSec ? 'fail' : 'doing')
  }
}
const TASKS: Task[] = [
  {
    name: '① 启动反应堆', desc: '把功率从 0 拉到 30% 并保持 3 秒', failMsg: '',
    check: holdTask({ lo: 28, hi: 40 }, 3, 90),
  },
  {
    name: '② 提升功率', desc: '限时 60 秒把功率从 30% 升到 80%', failMsg: '',
    startPower: 32,
    check: (s, el) => s.power >= 78 && s.power <= 100 ? 'done' : (s.power > 105 || el > 60 ? 'fail' : 'doing'),
  },
  {
    name: '③ 边界测试', desc: '摸到 95% 功率但绝不能超过 100%', failMsg: '',
    startPower: 80,
    check: (() => { let touched = false; let held = 0; let lastT: number | null = null; return (s, el) => {
      if (s.power > 100) return 'fail'
      if (s.power >= 93) touched = true
      if (lastT !== null && touched && s.power >= 80 && s.power <= 98) held += Math.max(0, el - lastT)
      lastT = el
      if (held >= 2) return 'done'
      return 'doing'
    } })(),
  },
  {
    name: '④ 应急降功率', desc: '冷却泵跳闸警报！20 秒内把功率降到 35% 以下（按 AZ-5 一键急停，或手动深插棒）', failMsg: '',
    startPower: 85,
    check: (s, el) => s.power < 35 ? 'done' : (s.temp > MELTDOWN_TEMP * 0.94 || el > 20 ? 'fail' : 'doing'),
  },
  {
    name: '⑤ 自动棒值守', desc: '自动调节棒已接管——设定目标功率，扰动下维持 70-80% 坚持 30 秒（可随时切回手动微调）', failMsg: '',
    startPower: 75,
    check: (() => { const h = holdTask({ lo: 70, hi: 80 }, 30, 120); return (s, el) => (s.power > 95 || s.temp > SAFE_TEMP) ? 'fail' : h(s, el) })(),
  },
]

// ===== 组件 =====
export default function ReactorView({ settings: _settings, onAbandon, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<ReactorState>({ power: 0, temp: 30, pressure: 1, neutron: 0 })
  // 控制棒分组状态：12 组手动棒目标值（初始全插入=停堆）；物理位置存 ref，按伺服限速跟踪目标
  const [banks, setBanks] = useState<number[]>(() => Array(GROUPS).fill(100))
  const [scramTarget, setScramTarget] = useState(0)
  const [autoMode, setAutoMode] = useState(false)
  const [autoTarget, setAutoTarget] = useState(75)
  const banksRef = useRef(banks); banksRef.current = banks
  const bankPosRef = useRef<number[]>(Array(GROUPS).fill(100))
  const autoPosRef = useRef(100)
  const scramPosRef = useRef(0)
  const scramTargetRef = useRef(scramTarget); scramTargetRef.current = scramTarget
  const autoModeRef = useRef(autoMode); autoModeRef.current = autoMode
  const autoTargetRef = useRef(autoTarget); autoTargetRef.current = autoTarget
  const [flow, setFlow] = useState(40)
  const flowRef = useRef(flow); flowRef.current = flow
  const [boron, setBoron] = useState(0)
  const [taskIdx, setTaskIdx] = useState(0)
  const [taskState, setTaskState] = useState<'doing' | 'done' | 'fail'>('doing')
  const [elapsed, setElapsed] = useState(0)
  const [meltdown, setMeltdown] = useState(false)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState(0)
  const [alarm, setAlarm] = useState(false)
  const pendingRef = useRef<Parameters<Props['onFinish']>[0] | null>(null)
  // paused：任务完成/失败后的冻结态（物理暂停，堆芯画面保持最后一帧；孩子点按钮再继续）
  const [paused, setPaused] = useState<null | 'done' | 'fail'>(null)
  const startRef = useRef(Date.now())
  const taskStartRef = useRef(Date.now())
  const disturbRef = useRef(0)
  const meltdownAtRef = useRef<number | null>(null)

  const task = TASKS[taskIdx]

  // 主循环：物理步进 + 任务判定 + 画布渲染
  useEffect(() => {
    if (done) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      // 冻结态：物理不演化，只渲染最后一帧（含熔毁动画的持续渲染）
      if (!paused) {
        // 任务④：冷却泵跳闸——流量被强制拖到 15%
        if (taskIdx === 3 && flowRef.current > 15) {
          flowRef.current = Math.max(15, flowRef.current - 20 * dt)
          setFlow(flowRef.current)
        }
        // 自动调节棒接管时：比例控制跟踪目标功率（参照 RBMK 的 LAC/LAP 自动棒）
        if (autoModeRef.current) {
          const err = autoTargetRef.current - stateRef.current.power
          const desired = Math.max(0, Math.min(100, autoPosRef.current - err * AUTO_KP * dt))
          const d = Math.max(-AUTO_RATE * dt, Math.min(AUTO_RATE * dt, desired - autoPosRef.current))
          autoPosRef.current = Math.max(0, Math.min(100, autoPosRef.current + d))
        }
        // 棒的机械移动（真实伺服限速：RBMK 名义 0.4m/s，插满需 18-21 秒）
        const step = ROD_RATE * dt
        bankPosRef.current = banksRef.current.map((target, i) => {
          const cur = bankPosRef.current[i]
          const d = Math.max(-step, Math.min(step, target - cur))
          return Math.max(0, Math.min(100, cur + d))
        })
        const sd = Math.max(-SCRAM_RATE * dt, Math.min(SCRAM_RATE * dt, scramTargetRef.current - scramPosRef.current))
        scramPosRef.current = Math.max(0, Math.min(100, scramPosRef.current + sd))
        // 任务⑤随机扰动（等效于控制棒轻微抖动）
        if (taskIdx === 4 && Math.random() < 0.02) disturbRef.current = (Math.random() - 0.5) * 8
        const effRods = Math.max(0, Math.min(100, rodEffect(bankPosRef.current, autoPosRef.current, scramPosRef.current) + disturbRef.current))
        const s = stepReactor(stateRef.current, effRods, flowRef.current, boron, dt)
        stateRef.current = s
        const el = (Date.now() - taskStartRef.current) / 1000
        setElapsed(el)
        // 熔毁判定：先播 ~3 秒爆炸序列（白热→白闪→冲击波/浓烟），再弹重试面板
        if (s.temp > MELTDOWN_TEMP || s.pressure > SAFE_PRESSURE * 1.6) {
          setMeltdown(true)
          meltdownAtRef.current = performance.now()
          playMeltdownSound()
          setTimeout(() => setPaused('fail'), 3000)
          return
        }
        setAlarm(s.temp > SAFE_TEMP || s.pressure > SAFE_PRESSURE)
        // 任务判定（进入区间即算摸到，保持按累计真实秒数）
        const r = task.check(s, el)
        if (r === 'done' && taskState === 'doing') {
          setTaskState('done')
          setScore((v) => v + 1)
          setPaused('done')   // 冻结，等孩子点「下一个任务」
        } else if (r === 'fail' && taskState === 'doing') {
          setTaskState('fail')
          setPaused('fail')   // 冻结，等孩子点「重试本任务」
        }
      }
      draw(canvasRef.current, stateRef.current, { banks: bankPosRef.current, auto: autoPosRef.current, scram: scramPosRef.current }, meltdown, alarm,
        meltdown && meltdownAtRef.current ? (performance.now() - meltdownAtRef.current) / 1000 : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [boron, flow, taskIdx, taskState, meltdown, alarm, done, paused])

  // 孩子点击「下一个任务」：解冻并切换（有 startPower 的任务重置堆态）
  const nextTask = () => {
    if (taskIdx + 1 < TASKS.length) {
      const next = TASKS[taskIdx + 1]
      if (next.startPower !== undefined) {
        stateRef.current = equilibriumState(next.startPower)
      }
      setScramTarget(0); scramTargetRef.current = 0; scramPosRef.current = 0
      setFlow(40); flowRef.current = 40
      setAutoMode(taskIdx + 1 === 4)
      setTaskIdx((i) => i + 1); setTaskState('doing'); taskStartRef.current = Date.now(); setPaused(null)
    } else {
      setPaused(null); finish('submit')   // 全部完成 → 通关过场 → 结算
    }
  }
  // 孩子点击「重试本任务」：回到本任务起点
  const retryTask = () => {
    const cur = TASKS[taskIdx]
    if (cur.startPower !== undefined) {
      stateRef.current = equilibriumState(cur.startPower)
    }
    setScramTarget(0); scramTargetRef.current = 0; scramPosRef.current = 0
    setFlow(40); flowRef.current = 40
    setAutoMode(taskIdx === 4)
    setMeltdown(false); setTaskState('doing'); taskStartRef.current = Date.now(); setPaused(null)
  }

  const finish = useCallback((by: 'submit' | 'fail') => {
    if (done) return
    setDone(true)
    const completed = score
    const questions: Question[] = TASKS.map((t, i) => ({
      index: i, a: 0, b: 0, op: 'add', text: t.name, answer: 0,
      carry: false, options: ['完成', '未完成'], answerText: i < completed ? '完成' : '未完成',
    }))
    pendingRef.current = {
      answers: TASKS.map((_, i) => i < completed ? '完成' : '未完成'),
      perQuestionMs: TASKS.map(() => 30000),
      usedMs: Date.now() - startRef.current,
      finishedBy: by,
      questions,
    }
  }, [done, score])

  // 过场「查看成绩」按钮：真正提交结算
  const onFinishWrap = () => { if (pendingRef.current) onFinish(pendingRef.current) }

  const s = stateRef.current

  // ===== 过场：通关 / 熔毁（全屏仪式感，孩子点击后才进入结算页）=====
  if (done) {
    const passed = score === TASKS.length
    return (
      <div className={`reactor-ending ${passed ? 'win' : 'lose'}`}>
        <div className="reactor-ending-inner">
          <div className="reactor-ending-emoji">{passed ? '🏆' : meltdown ? '☢️' : '💥'}</div>
          <h1>{passed ? '反应堆全程受控！' : meltdown ? '堆芯熔毁了' : '任务中止'}</h1>
          <p className="reactor-ending-sub">
            {passed
              ? '你完成了全部 5 个主控任务，是一名合格的反应堆操作员！'
              : meltdown
                ? '温度和压力冲破了安全壳——记住：控制棒就是反应堆的刹车，下次早点踩！'
                : `完成了 ${score}/${TASKS.length} 个任务，再练练就稳了！`}
          </p>
          {passed && (
            <p className="reactor-ending-sub" style={{ opacity: 0.65, fontSize: 13 }}>
              历史注脚：真实的 AZ-5 按钮按下后，控制棒需要约 18 秒才能插入堆芯——1986 年那个夜晚，这 18 秒改变了一切。
            </p>
          )}
          <div className="reactor-ending-score">
            {TASKS.map((tk, i) => (
              <span key={tk.name} className={i < score ? 'chip ok' : 'chip'}>{i < score ? '✅' : '⬜'} {tk.name}</span>
            ))}
          </div>
          <button className="reactor-ending-btn" onClick={() => onFinishWrap()}>查看成绩 →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="reactor-page">
      <div className="race-head">
        <button className="ghost" onClick={onAbandon}>← 退出</button>
        <h2>☢️ 核电站主控实践</h2>
        <span className="reactor-taskname">{task?.name ?? ''}</span>
      </div>

      <div className="reactor-task">
        <b>{task?.name}</b> {task?.desc}
        {taskState === 'done' && <span className="reactor-ok"> ✅ 完成！</span>}
        {taskState === 'fail' && <span className="reactor-bad"> ❌ 任务失败</span>}
        {meltdown && <span className="reactor-bad"> ☢️ 堆芯熔毁！</span>}
        <span className="reactor-elapsed">{elapsed.toFixed(0)}s</span>
      </div>

      <div className="reactor-grid">
        <div className="reactor-canvas-wrap">
          <canvas ref={canvasRef} width={420} height={420} className={alarm && !meltdown ? 'reactor-alarm' : ''} />
          {paused === 'done' && (
            <div className="reactor-overlay ok">
              <div className="reactor-overlay-emoji">✅</div>
              <b>{task?.name} 完成！</b>
              <p>{taskIdx + 1 < TASKS.length ? '反应堆已稳定，准备下一个任务。' : '全部任务完成！'}</p>
              <button onClick={nextTask}>{taskIdx + 1 < TASKS.length ? '▶ 下一个任务' : '🏁 完成任务'}</button>
            </div>
          )}
          {paused === 'fail' && (
            <div className="reactor-overlay bad">
              <div className="reactor-overlay-emoji">{meltdown ? '☢️' : '💥'}</div>
              <b>{meltdown ? '堆芯熔毁！' : '任务失败'}</b>
              <p>{meltdown ? '安全壳破裂——控制棒是反应堆的刹车，功率太高要果断插入！' : '别灰心，再试一次这个任务。'}</p>
              <button onClick={retryTask}>↻ 重试本任务</button>
            </div>
          )}
        </div>
        <div className="reactor-controls">
          <Gauge label="功率" value={s.power} unit="%" max={130} warn={100} color="#4a90e2" />
          <Gauge label="堆芯温度" value={s.temp} unit="℃" max={520} warn={SAFE_TEMP} color={s.temp > SAFE_TEMP ? '#e2574a' : '#e2904a'} />
          <Gauge label="一回路压力" value={s.pressure} unit="bar" max={260} warn={SAFE_PRESSURE} color={s.pressure > SAFE_PRESSURE ? '#e2574a' : '#9c6ade'} />
          <Gauge label="中子密度" value={s.neutron} unit="" max={130} warn={110} color="#4ae2a0" />

          <div className="reactor-bank-panel">
            <div className="reactor-bank-head">
              <span>手动控制棒 · 12组×8根（插入深度%）</span>
              <span className="reactor-bank-btns">
                <button onClick={() => setBanks(Array(GROUPS).fill(100))}>⛔ 全插</button>
                <button onClick={() => setBanks(Array(GROUPS).fill(50))}>半棒</button>
                <button onClick={() => setBanks(Array(GROUPS).fill(15))}>⚡ 浅棒</button>
              </span>
            </div>
            <div className="reactor-bank-grid">
              {banks.map((v, i) => (
                <div key={i} className="reactor-bank">
                  <input type="range" min={0} max={100} value={v} aria-label={`第${i + 1}组控制棒`}
                    onChange={(e) => setBanks((bs) => bs.map((b, j) => j === i ? Number(e.target.value) : b))} />
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <div className="reactor-bank-foot">棒有机械惯性：全提到全插约需 17 秒（参照 RBMK 0.4m/s 伺服限速）</div>
          </div>
          <button className={`reactor-az5${scramTarget === 100 ? ' active' : ''}`} onClick={() => setScramTarget(100)}>
            🛑 AZ-5 紧急停堆（24根保护棒全速插入）
          </button>
          {autoMode && (
            <div className="reactor-ctl">
              <div className="reactor-ctl-head"><span>自动调节棒 · 目标功率</span><b>{autoTarget}%</b></div>
              <input type="range" min={50} max={95} value={autoTarget} onChange={(e) => setAutoTarget(Number(e.target.value))} />
              <span className="reactor-ctl-hint">自动棒实时跟踪目标功率（24根）</span>
            </div>
          )}
          <Control label="冷却水流量" value={flow} onChange={(v) => { setFlow(v); flowRef.current = v }} hint={taskIdx === 3 ? '冷却泵跳闸！流量不受控 ⚠️' : flow < 25 ? '冷却不足 ⚠️' : ''} />
          <Control label="硼浓度（慢效抑制）" value={boron} onChange={setBoron} hint={boron > 60 ? '反应性被压制' : ''} />
        </div>
      </div>
      <p className="reactor-tip">任务 {Math.min(taskIdx + 1, TASKS.length)}/{TASKS.length} · 已完成 {score} 个 · 温度/压力超红区会熔毁！</p>
    </div>
  )
}

// ===== 仪表盘（环形）=====
function Gauge({ label, value, unit, max, warn, color }: { label: string; value: number; unit: string; max: number; warn: number; color: string }) {
  const pct = Math.min(1, value / max)
  const over = value > warn
  const R = 34, C = 2 * Math.PI * R
  return (
    <div className={`gauge${over ? ' over' : ''}`}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={R} fill="none" stroke="#2a3a52" strokeWidth={9} />
        <circle cx={42} cy={42} r={R} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${pct * C} ${C}`} strokeLinecap="round" transform="rotate(-90 42 42)" />
        <circle cx={42 + R * Math.cos((-90 + (warn / max) * 360) * Math.PI / 180)} cy={42 + R * Math.sin((-90 + (warn / max) * 360) * Math.PI / 180)} r={3} fill="#e2574a" />
      </svg>
      <div className="gauge-val">{value.toFixed(unit === 'bar' ? 0 : 0)}<small>{unit}</small></div>
      <div className="gauge-label">{label}</div>
    </div>
  )
}

// ===== 控制滑杆 =====
function Control({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="reactor-ctl">
      <div className="reactor-ctl-head"><span>{label}</span><b>{value}</b></div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="reactor-ctl-hint">{hint}</span>}
    </div>
  )
}

// ===== 熔毁音效（WebAudio 合成：低频轰鸣 + 爆炸噪声 + 警报，无音频资源文件）=====
let audioCtx: AudioContext | null = null
function playMeltdownSound() {
  try {
    audioCtx = audioCtx ?? new AudioContext()
    const ctx = audioCtx, t0 = ctx.currentTime
    // ① 低频轰鸣（堆芯失控 0-1s）
    const rumble = ctx.createOscillator(), rGain = ctx.createGain()
    rumble.type = 'sine'; rumble.frequency.setValueAtTime(46, t0)
    rumble.frequency.linearRampToValueAtTime(30, t0 + 1.1)
    rGain.gain.setValueAtTime(0.0001, t0)
    rGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.25)
    rGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.3)
    rumble.connect(rGain); rGain.connect(ctx.destination)
    rumble.start(t0); rumble.stop(t0 + 1.4)
    // ② 爆炸（1s 时白噪声爆发 + 低通扫频 2s）
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2)
    const boom = ctx.createBufferSource(); boom.buffer = buf
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2400, t0 + 1); lp.frequency.exponentialRampToValueAtTime(120, t0 + 3)
    const bGain = ctx.createGain(); bGain.gain.setValueAtTime(0.9, t0 + 1)
    bGain.gain.exponentialRampToValueAtTime(0.001, t0 + 3.2)
    boom.connect(lp); lp.connect(bGain); bGain.connect(ctx.destination)
    boom.start(t0 + 1)
    // ③ 警报（爆炸后 1.5s 起, 三声）
    for (let k = 0; k < 3; k++) {
      const siren = ctx.createOscillator(), sGain = ctx.createGain()
      siren.type = 'square'; siren.frequency.value = 660
      const st = t0 + 1.6 + k * 0.5
      sGain.gain.setValueAtTime(0.06, st)
      sGain.gain.exponentialRampToValueAtTime(0.001, st + 0.3)
      siren.connect(sGain); sGain.connect(ctx.destination)
      siren.start(st); siren.stop(st + 0.32)
    }
  } catch { /* 无音频环境静默 */ }
}

// ===== Canvas 堆芯渲染 =====
function draw(canvas: HTMLCanvasElement | null, s: ReactorState, rodPos: { banks: number[]; auto: number; scram: number }, meltdown: boolean, alarm: boolean, mtSec = 0) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2 + 20
  // 熔毁序列：震屏（0.8s 起渐强, 白闪后渐弱）
  if (meltdown) {
    const amp = mtSec < 1 ? mtSec * 4 : Math.max(1.5, 14 - mtSec * 4)
    ctx.translate((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp * 2)
  }
  ctx.clearRect(0, 0, W, H)
  // 厂房背景
  ctx.fillStyle = meltdown ? '#2a0d0d' : alarm ? '#1e2431' : '#18202e'
  ctx.fillRect(0, 0, W, H)
  // 压力壳
  ctx.strokeStyle = '#3a4c66'; ctx.lineWidth = 8
  ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.stroke()
  // 堆芯辉光（颜色随温度蓝→橙→红）
  const heat = Math.min(1, s.temp / MELTDOWN_TEMP)
  const glowR = meltdown ? 255 : Math.round(74 + heat * 181)
  const glowG = meltdown ? 60 : Math.round(144 - heat * 100)
  const glowB = meltdown ? 30 : Math.round(226 - heat * 180)
  const coreR = 60 + s.power * 0.35 + Math.sin(Date.now() / 300) * 3
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, coreR)
  grad.addColorStop(0, `rgba(${glowR},${glowG},${glowB},${meltdown ? 0.95 : 0.55 + heat * 0.4})`)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill()
  // 控制棒（从顶部插入）：12 组手动棒各 2 根代表 + 自动棒（绿）+ AZ-5 保护棒（红）
  for (let g = 0; g < GROUPS; g++) {
    const x = cx - 143 + g * 26
    const h = 20 + (rodPos.banks[g] / 100) * 130
    ctx.fillStyle = '#8a99b5'
    ctx.fillRect(x - 5, cy - 150, 4, h)
    ctx.fillRect(x + 1, cy - 150, 4, h)
  }
  ctx.fillStyle = '#4ae2a0'
  ctx.fillRect(cx - 13, cy - 150, 5, 20 + (rodPos.auto / 100) * 130)
  ctx.fillRect(cx + 8, cy - 150, 5, 20 + (rodPos.auto / 100) * 130)
  if (rodPos.scram > 0) {
    ctx.fillStyle = '#e2574a'
    ctx.fillRect(cx - 33, cy - 150, 5, 20 + (rodPos.scram / 100) * 130)
    ctx.fillRect(cx + 28, cy - 150, 5, 20 + (rodPos.scram / 100) * 130)
  }
  // 燃料棒排
  ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.85)`
  for (let i = -2; i <= 2; i++) {
    for (let j = 0; j < 3; j++) {
      ctx.fillRect(cx + i * 26 - 4, cy - 60 + j * 44, 8, 34)
    }
  }
  // 中子粒子（密度随 neutron，速度随 power）
  const nCount = Math.round(s.neutron * 1.1)
  ctx.fillStyle = '#fff'
  for (let i = 0; i < nCount; i++) {
    const a = (i * 137.5 + Date.now() / (60 - Math.min(50, s.power * 0.4))) % 360 * Math.PI / 180
    const rr = 18 + ((i * 53) % 110)
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.6, 0, Math.PI * 2); ctx.fill()
  }
  // 熔毁特效：三阶段序列（白热化 → 白闪+冲击波 → 浓烟火星+红光扫射）
  if (meltdown) {
    // 阶段① 0-1s：堆芯白热化膨胀 + 警报红光渐强
    if (mtSec < 1.2) {
      const k = Math.min(1, mtSec)
      const flash = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60 + k * 150)
      flash.addColorStop(0, `rgba(255,255,240,${0.35 + k * 0.6})`)
      flash.addColorStop(1, 'rgba(255,120,40,0)')
      ctx.fillStyle = flash
      ctx.beginPath(); ctx.arc(cx, cy, 60 + k * 150, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = `rgba(255,40,20,${k * 0.18 * (0.6 + 0.4 * Math.sin(Date.now() / 70))})`
      ctx.fillRect(-30, -30, W + 60, H + 60)
    }
    // 阶段② 1-1.6s：爆炸白闪 + 冲击波环
    if (mtSec >= 1 && mtSec < 2.2) {
      const k = (mtSec - 1) / 1.2
      ctx.fillStyle = `rgba(255,252,240,${Math.max(0, 0.95 - k * 1.4)})`
      ctx.fillRect(-30, -30, W + 60, H + 60)
      for (let ring = 0; ring < 3; ring++) {
        const rr = k * (W * 0.75) - ring * 34
        if (rr <= 0) continue
        ctx.strokeStyle = `rgba(255,220,180,${Math.max(0, 0.7 - k - ring * 0.15)})`
        ctx.lineWidth = 10 - ring * 3
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
      }
    }
    // 阶段③ 1.4s+：火星飞溅 + 浓烟上升 + 警报红光扫射
    if (mtSec >= 1.4) {
      const life = mtSec - 1.4
      for (let i = 0; i < 26; i++) {
        const seed = i * 7919
        const a = ((seed % 628) / 100) + Math.sin(seed) * 0.5
        const spd = 60 + (seed % 140)
        const px = cx + Math.cos(a) * spd * life
        const py = cy + Math.sin(a) * spd * life + 60 * life * life
        if (px < -20 || px > W + 20 || py > H + 20) continue
        ctx.fillStyle = `rgba(255,${140 + (seed % 100)},60,${Math.max(0, 0.9 - life * 0.5)})`
        ctx.beginPath(); ctx.arc(px, py, 2.5 - Math.min(1.8, life * 0.6), 0, Math.PI * 2); ctx.fill()
      }
      for (let i = 0; i < 9; i++) {
        const seed = i * 104729
        const rise = ((life * 46 + seed % 90) % (H * 0.8))
        const sx = cx + ((seed % 160) - 80) * (1 + life * 0.12)
        const sr = 26 + rise * 0.22 + (seed % 20)
        ctx.fillStyle = `rgba(40,36,34,${Math.max(0, 0.5 - rise / (H * 0.9))})`
        ctx.beginPath(); ctx.arc(sx, cy - rise, sr, 0, Math.PI * 2); ctx.fill()
      }
      const sweepA = (Date.now() / 500) % (Math.PI * 2)
      const sweep = ctx.createLinearGradient(cx, cy, cx + Math.cos(sweepA) * W, cy + Math.sin(sweepA) * W)
      sweep.addColorStop(0, 'rgba(255,50,30,0.16)')
      sweep.addColorStop(1, 'rgba(255,50,30,0)')
      ctx.fillStyle = sweep
      ctx.fillRect(-30, -30, W + 60, H + 60)
    }
    // 常驻：红雾 + 裂缝 + 标题
    ctx.fillStyle = `rgba(255,80,40,${0.25 + 0.2 * Math.sin(Date.now() / 90)})`
    ctx.fillRect(-30, -30, W + 60, H + 60)
    ctx.strokeStyle = '#ffb199'; ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - 60, cy - 120); ctx.lineTo(cx - 20, cy - 40); ctx.lineTo(cx - 70, cy + 30)
    ctx.moveTo(cx + 50, cy - 100); ctx.lineTo(cx + 30, cy + 10); ctx.lineTo(cx + 80, cy + 80)
    ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('☢️ 堆芯熔毁 ☢️', cx, 50)
  }
  // 顶部文字状态
  ctx.fillStyle = alarm || meltdown ? '#ff8a75' : '#9ab'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'
  ctx.fillText(`功率 ${s.power.toFixed(1)}% · ${s.temp.toFixed(0)}℃ · ${s.pressure.toFixed(0)} bar`, 14, 26)
}
