// 游乐场大陆：游戏关的数据生成（确定性，种子可复现）
// 三个玩法的关卡进度都合成为标准 Question[]，使星星/错题本/AI 点评/积分榜全链路复用
import { mulberry32, generateQuestions, type Question } from '@dsh-math-tutor/math-generator/core'
import { vocabThemes } from './english'
import { POEMS } from './chinese'

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ===== 单词消消乐：英文 ↔ 中文配对 =====
const MATCH_THEMES: Record<string, string[]> = {
  'arc-match1': ['eng-greet', 'eng-school'],
  'arc-match2': ['eng-color', 'eng-number'],
  'arc-match3': ['eng-animal', 'eng-food'],
}

export interface MatchPair { en: string; zh: string }

export function matchPairs(stageId: string, seed: number, count: number): MatchPair[] {
  const pool = vocabThemes(MATCH_THEMES[stageId] ?? MATCH_THEMES['arc-match1'])
  const rng = mulberry32(seed)
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length)).map(([en, zh]) => ({ en, zh }))
}

// 合成选择题记录：每对一题「英文的中文是？」（options 仅供结算页/错题本展示，游玩时不出现）
export function matchQuestions(pairs: MatchPair[], seed: number): Question[] {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const zhPool = pairs.map((p) => p.zh)
  return pairs.map((p, index) => {
    const distract = shuffle(zhPool.filter((z) => z !== p.zh), rng).slice(0, 3)
    const options = shuffle([p.zh, ...distract], rng)
    return { index, a: 0, b: 0, op: 'add' as const, text: `「${p.en}」的中文是？`, answer: 0, carry: false, options, answerText: p.zh }
  })
}

// ===== 古诗词接龙：给上句接下句（选项=4句诗）=====
export interface ChainRound {
  poemTitle: string
  prev: string     // 上句（首句则为诗题提示）
  next: string     // 正确下句
  options: string[]
}

export function poemChainRounds(seed: number, count: number): { rounds: ChainRound[]; questions: Question[] } {
  const rng = mulberry32(seed)
  const allLines = POEMS.flatMap((p) => p.lines)
  // 候选：每首诗的相邻句对（上句 → 下句）
  const candidates: Array<{ poem: (typeof POEMS)[number]; i: number }> = []
  POEMS.forEach((poem) => {
    for (let i = 0; i < poem.lines.length - 1; i += 1) candidates.push({ poem, i })
  })
  const picked = shuffle(candidates, rng).slice(0, Math.min(count, candidates.length))
  const rounds = picked.map(({ poem, i }) => {
    const next = poem.lines[i + 1]
    const distract = shuffle(allLines.filter((l) => l !== next && l !== poem.lines[i]), rng).slice(0, 3)
    return { poemTitle: `《${poem.title}》${poem.author}`, prev: poem.lines[i], next, options: shuffle([next, ...distract], rng) }
  })
  const questions = rounds.map((r, index) => ({
    index, a: 0, b: 0, op: 'add' as const,
    text: `${r.poemTitle}「${r.prev}」的下一句是？`,
    answer: 0, carry: false, options: r.options, answerText: r.next,
  }))
  return { rounds, questions }
}

// ===== 数字贪吃蛇：每轮一道口算，吃带正确答案的食物 =====
const SNAKE_MAX: Record<string, number> = { 'arc-snake1': 20, 'arc-snake2': 100 }

export interface SnakeRound {
  question: Question
  foods: number[]   // 4 个数字（1 正确 + 3 干扰）
}

export function snakeRounds(stageId: string, seed: number, count: number, level: 1 | 2 | 3): { rounds: SnakeRound[]; questions: Question[] } {
  const max = SNAKE_MAX[stageId] ?? 20
  const questions = generateQuestions({ count, max, ops: ['add', 'sub'], seed, level })
  const rng = mulberry32(seed ^ 0x51ab)
  const rounds = questions.map((question) => {
    const correct = question.answer
    const distract = new Set<number>()
    const offsets = shuffle([1, -1, 2, -2, 10, -10, 3, -3, 5, -5], rng)
    for (const off of offsets) {
      if (distract.size >= 3) break
      const v = correct + off
      if (v >= 0 && v !== correct) distract.add(v)
    }
    return { question, foods: shuffle([correct, ...distract], rng) }
  })
  return { rounds, questions }
}

// 蛇速（毫秒/格）：按档位，数值越小越快
export function snakeTickMs(level: number): number {
  return level >= 3 ? 150 : level === 2 ? 190 : 230
}
