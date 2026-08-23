// 竞赛码：多人竞技基础。同一竞赛码 = 同一参数 + 同一 seed = 同一份题目。
// 格式：MODE-LEVEL-COUNT-SECONDS-SEED，如 G2A-L2-60-300-839201
import type { RaceSettings } from './types'
import type { Op } from '@dsh-math-tutor/math-generator/core'

export const MODES: Record<string, { max: number; ops: Op[]; label: string }> = {
  G2A: { max: 100, ops: ['add', 'sub'], label: '100以内加减法' },
  G2P: { max: 100, ops: ['add'], label: '100以内加法' },
  G2S: { max: 100, ops: ['sub'], label: '100以内减法' },
}

export function encodeRaceCode(s: RaceSettings): string {
  return `${s.mode}-L${s.level}-${s.count}-${s.durationSec}-${s.seed}`
}

export function decodeRaceCode(code: string): RaceSettings | null {
  const m = /^([A-Z0-9]+)-L([123])-(\d+)-(\d+)-(\d+)$/.exec(code.trim().toUpperCase())
  if (!m) return null
  const preset = MODES[m[1]]
  if (!preset) return null
  return {
    mode: m[1],
    level: Number(m[2]) as 1 | 2 | 3,
    count: Math.min(Math.max(Number(m[3]), 1), 200),
    durationSec: Math.min(Math.max(Number(m[4]), 30), 3600),
    seed: Number(m[5]) >>> 0,
    max: preset.max,
    ops: preset.ops,
  }
}

export function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

export function defaultSettings(): RaceSettings {
  return { mode: 'G2A', level: 2, count: 60, durationSec: 300, seed: newSeed(), max: 100, ops: ['add', 'sub'] }
}
