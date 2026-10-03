// 反应堆物理回归冒烟：修改 reactorPhysics.ts 后必须运行
// 用法: node apps/web/scripts/reactor-smoke.mjs
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const here = path.dirname(fileURLToPath(import.meta.url))
// esbuild 是 vite 的传递依赖(pnpm 平铺在 .pnpm), 动态定位, 避免新增依赖
function loadEsbuild() {
  const root = path.join(here, '../../..')
  for (const base of [path.join(here, '../node_modules'), path.join(root, 'node_modules')]) {
    const pnpmDir = path.join(base, '.pnpm')
    if (!fs.existsSync(pnpmDir)) continue
    const hit = fs.readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d))
    if (hit) return createRequire(import.meta.url)(path.join(pnpmDir, hit, 'node_modules/esbuild'))
  }
  throw new Error('esbuild not found under node_modules/.pnpm')
}
const { buildSync } = loadEsbuild()
const out = path.join(os.tmpdir(), 'reactor-physics-smoke.mjs')
buildSync({ entryPoints: [path.join(here, '../src/lib/reactorPhysics.ts')], bundle: true, format: 'esm', outfile: out })
const P = await import(pathToFileURL(out).href)
const { stepReactor, equilibriumState, SAFE_TEMP, SAFE_PRESSURE, MELTDOWN_TEMP } = P

let failures = 0
function assert(cond, name, detail = '') {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (detail ? ` (${detail})` : ''))
  if (!cond) failures++
}
function melt(s) { return s.temp > MELTDOWN_TEMP || s.pressure > SAFE_PRESSURE * 1.6 }
function sim(s0, ctrl, seconds, dt = 0.05) {
  let s = { ...s0 }
  for (let t = 0; t < seconds; t += dt) {
    const c = ctrl(t, s)
    s = stepReactor(s, c.rods, c.flow, c.boron ?? 0, dt)
    if (melt(s)) return { s, meltedAt: t }
  }
  return { s, meltedAt: null }
}

// ① 平衡态重置：各任务 startPower 开局不应触发报警
console.log('场景A: equilibriumState 重置开局安全')
for (const p of [32, 80, 85, 75]) {
  const s = equilibriumState(p)
  assert(s.temp <= SAFE_TEMP && s.pressure <= SAFE_PRESSURE, `power=${p} → temp ${s.temp.toFixed(0)}℃ / ${s.pressure.toFixed(0)}bar 不超线`)
}

// ② 任务① 启动: 停堆态 → 棒效~77 → 功率应升到 28-40 区间
console.log('场景B: 任务① 启动可达标')
{
  const { s, meltedAt } = sim({ power: 0, temp: 30, pressure: 1, neutron: 0 }, () => ({ rods: 77, flow: 50 }), 60)
  assert(meltedAt === null, '不熔毁')
  assert(s.power >= 28 && s.power <= 40, `60s 后功率 ${s.power.toFixed(1)}% 在 28-40 区间`)
}

// ③ 任务④ 应急: 85% 平衡态 → AZ-5 全插 + 默认冷却 40 → 20s 内 <35% 且不熔毁
console.log('场景C: 任务④ AZ-5 急停可救回')
{
  const { s, meltedAt } = sim(equilibriumState(85), () => ({ rods: 100, flow: 40 }), 20)
  assert(meltedAt === null, '不熔毁')
  assert(s.power < 35, `20s 后功率 ${s.power.toFixed(1)}% < 35%`)
}

// ④ 作死: 95% 平衡态 → 全抽棒 + 冷却 10% → 必须熔毁（安全教学成立）
console.log('场景D: 全抽棒+低冷却必熔毁')
{
  const { meltedAt } = sim(equilibriumState(95), () => ({ rods: 0, flow: 10 }), 30)
  assert(meltedAt !== null, `熔毁于 ${meltedAt?.toFixed(1)}s`)
}

// ⑤ 任务⑤ 值守: 75% 平衡态 + 目标棒效保持 → 30s 稳在 70-80
console.log('场景E: 任务⑤ 自动值守可保持')
{
  // 简化 PI: 每秒按偏差调棒效
  let rods = 55
  const { s, meltedAt } = sim(equilibriumState(75), (t, cur) => {
    rods = Math.max(0, Math.min(100, rods + (cur.power - 75) * 2 * 0.05))  // P 控制(按 dt 缩放), 收敛 ~78%
    return { rods, flow: 55 }
  }, 30)
  assert(meltedAt === null, '不熔毁')
  assert(s.power >= 68 && s.power <= 82, `30s 后功率 ${s.power.toFixed(1)}% 约 70-80`)
}

console.log(failures === 0 ? '\n全部通过 ✅' : `\n${failures} 项失败 ❌`)
process.exit(failures === 0 ? 0 : 1)
