import type { SessionRecord, WrongItem } from './types'
import { pushProfile } from './sync'

const KEY = 'dsh-math-tutor:sessions'

export function loadSessions(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveSession(record: SessionRecord): void {
  const all = loadSessions()
  all.unshift(record)
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)))
  pushProfile()
}

// 错题本：跨会话聚合，同一题目保留最近记录与错误次数
export interface MistakeEntry extends WrongItem {
  times: number
  lastDate: string
}

export function loadMistakes(): MistakeEntry[] {
  const map = new Map<string, MistakeEntry>()
  for (const s of loadSessions()) {
    for (const w of s.wrong) {
      const key = `${w.question.a}${w.question.op}${w.question.b}`
      const prev = map.get(key)
      if (prev) {
        prev.times += 1
        if (s.date > prev.lastDate) {
          prev.lastDate = s.date
          prev.given = w.given
        }
      } else {
        map.set(key, { ...w, times: 1, lastDate: s.date })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.times - a.times)
}

const PROFILE_KEY = 'dsh-math-tutor:profile'

export function loadProfile(): import('./types').LearnerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProfile(p: import('./types').LearnerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  pushProfile()
}
