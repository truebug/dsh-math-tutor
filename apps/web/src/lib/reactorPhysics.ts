// 反应堆物理核心（纯函数，零 React 依赖）——供 ReactorView 与 scripts/reactor-smoke.mjs 回归测试共用
// 出题判分红线：本模块即「判分物理」，任何参数改动必须跑回归（见 scripts/reactor-smoke.mjs）

// ===== 简化物理模型（确定性，无量纲）=====
// 状态：power 0-130%、temp 堆芯温度、pressure 一回路压力、neutron 中子密度
// 输入：effRods 等效棒深 0-100、flow 冷却流量 0-100、boron 硼浓度 0-100
export interface ReactorState { power: number; temp: number; pressure: number; neutron: number }

export const SAFE_TEMP = 320      // 安全温度上限（℃）
export const SAFE_PRESSURE = 160  // 安全压力上限（bar）
export const MELTDOWN_TEMP = 480  // 熔毁温度

// ===== 控制棒分组（参照 RBMK：211 根棒分手动/自动/紧急保护，机械限速 0.4m/s ≈ 18-21 秒插满）=====
// 全部以「插入深度 0-100」表示。96 = 12组 × 8根（手动棒），另有 24 根自动调节棒 + 24 根 AZ-5 紧急保护棒
export const GROUPS = 12
export const RODS_PER_GROUP = 8
export const MANUAL_RODS = GROUPS * RODS_PER_GROUP      // 96 根手动棒
export const AUTO_RODS = 24                             // 自动调节棒（含功率调节棒组）
export const SCRAM_RODS = 24                            // 紧急保护棒
export const ROD_RATE = 6        // 手动棒机械限速 %/s（类比 0.4m/s：按 AZ-5 都要 ~17s）
export const AUTO_RATE = 10      // 自动棒跟踪限速 %/s
export const SCRAM_RATE = 100    // 事故前 AZ-5 同样不快（100%/s）
export const AUTO_KP = 1.1       // 自动棒比例增益

// 分组反应性：等效插入深度 = 各棒插入深度的根数加权平均（棒越多插得越深 → 反应性越低）
export function rodEffect(groups: number[], auto: number, scram: number): number {
  const manualSum = groups.reduce((a, g) => a + g * RODS_PER_GROUP, 0)
  return (manualSum + auto * AUTO_RODS + scram * SCRAM_RODS) / (MANUAL_RODS + AUTO_RODS + SCRAM_RODS)
}

// 任务切换/重试时的堆态重置：从满冷却平衡态推导，避免开局就触发报警灯
export function equilibriumState(power: number): ReactorState {
  const temp = Math.max(30, (power * 3.2 - 40) / 0.9)
  return { power, temp, pressure: Math.max(1, 1 + Math.pow(Math.max(0, temp - 90) / 100, 1.7) * 55), neutron: power }
}

export function stepReactor(s: ReactorState, effRods: number, flow: number, boron: number, dt: number): ReactorState {
  // 反应性：控制棒越深越低，硼抑制；功率目标跟踪中子密度
  const reactivity = Math.max(0, (100 - effRods) / 100 - boron / 250)
  const targetNeutron = reactivity * 130
  const neutron = s.neutron + (targetNeutron - s.neutron) * 0.25 * dt * 60 / 60
  // 功率滞后于中子（惯性）
  const power = s.power + (neutron - s.power) * 0.12 * dt * 60 / 60
  // 温度：产热 - 冷却带走
  const heat = power * 3.2
  const cooling = (flow / 100) * (s.temp * 0.9 + 40)
  const temp = Math.max(25, s.temp + (heat - cooling) * 0.02 * dt * 60 / 60)
  // 压力随温度非线性上升
  const pressure = Math.max(1, 1 + Math.pow(Math.max(0, temp - 90) / 100, 1.7) * 55)
  return { power, temp, pressure, neutron }
}
