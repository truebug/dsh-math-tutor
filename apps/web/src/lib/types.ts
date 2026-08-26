import type { Level, Op, Question } from '@dsh-math-tutor/math-generator/core'

export interface RaceSettings {
  mode: string        // 如 'G2A'：二年级·加减
  count: number       // 题量，默认 60
  max: number         // 结果上限，默认 100
  ops: Op[]
  durationSec: number // 限时秒数，默认 300
  seed: number
  level: Level        // 难度：1 基础 / 2 进阶 / 3 挑战
  carryRatio?: number     // 画像自适应的进退位占比（覆盖档位默认；竞赛码导入时不设置）
  adaptiveReason?: string // 自适应说明文案（设置页展示）
  imported?: boolean      // 是否来自竞赛码导入（导入=锁定参数，不做自适应，保证同码同题）
  domain?: 'int' | 'dec'  // dec = 小数加减（四年级）
  kind?: 'letters' | 'vocab' | 'sentence' | 'antonym' | 'chinese' | 'poem' | 'chars'  // 英语选择题内容（不使用数字出题器）
    | 'match' | 'poemchain' | 'snake'  // 游乐场：游戏关（独立组件承载，结束时合成标准答题记录）
  subject?: Subject       // 科目（用于 AI 点评分科 prompt）
  stageId?: string      // 闯关 ID（成绩用于记星）
  daily?: boolean       // 每日挑战（成绩记入 daily 星）
  customQuestions?: Question[]  // 错题重练：直接使用给定题集（忽略 seed）
}

export interface WrongItem {
  question: Question
  given: number | string | null
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

export type View = 'map' | 'setup' | 'race' | 'result' | 'mistakes' | 'dashboard'

export type Gender = 'boy' | 'girl' | 'secret'
export type Subject = 'math' | 'chinese' | 'english' | 'arcade'

export interface LearnerProfile {
  nickname: string
  gender: Gender
  age: number
  grade: 2 | 3 | 4 | 5
  subjects: Subject[]
  createdAt: string // ISO
}
