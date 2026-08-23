import type { Level, Op, Question } from '@dsh-math-tutor/math-generator/core'

export interface RaceSettings {
  mode: string        // 如 'G2A'：二年级·加减
  count: number       // 题量，默认 60
  max: number         // 结果上限，默认 100
  ops: Op[]
  durationSec: number // 限时秒数，默认 300
  seed: number
  level: Level        // 难度：1 基础 / 2 进阶 / 3 挑战
  customQuestions?: Question[]  // 错题重练：直接使用给定题集（忽略 seed）
}

export interface WrongItem {
  question: Question
  given: number | null
}

export interface SessionRecord {
  id: string
  owner: string         // 学习者昵称，记录归属到人
  date: string           // ISO
  settings: RaceSettings
  usedMs: number
  total: number
  answered: number
  correct: number
  accuracy: number
  perQuestionMs: number[]
  wrong: WrongItem[]
  finishedBy: 'submit' | 'timeout'
}

export type View = 'setup' | 'race' | 'result' | 'mistakes'

export type Gender = 'boy' | 'girl' | 'secret'
export type Subject = 'math' | 'chinese' | 'english'

export interface LearnerProfile {
  nickname: string
  gender: Gender
  age: number
  grade: 2 | 3 | 4 | 5
  subjects: Subject[]
  createdAt: string // ISO
}
