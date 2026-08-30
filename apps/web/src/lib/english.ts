// 英语大陆内容生成器：确定性出题（种子可复现，支持竞赛码/每日挑战语义）
// 词表依据：牛津上海版（一年级起点）1-2 年级主题词库（djfml/englishoxfordshanghaiedition
// 全量 1042 词带音标的 Anki 牌组交叉核对）+ 沪教版（三年级起点）教材词表，
// 见 docs/curriculum/english.md
import { mulberry32, type Question } from '@dsh-math-tutor/math-generator/core'
import { IPA_MAP } from './english-ipa'

// 题干展示音标：英译中题目在英文词后附 IPA（取自旧牛津体系映射，帮助拼读）
function withIpa(en: string): string {
  const ipa = IPA_MAP[en.toLowerCase()]?.[0]
  return ipa ? `${en} /${ipa}/` : en
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function toChoice(index: number, text: string, correct: string, pool: string[], rng: () => number): Question {
  const distract = new Set<string>()
  const others = pool.filter((p) => p !== correct)
  while (distract.size < 3 && distract.size < others.length) {
    distract.add(others[Math.floor(rng() * others.length)])
  }
  const options = shuffle([correct, ...distract], rng)
  return { index, a: 0, b: 0, op: 'add' as const, text, answer: 0, carry: false, options, answerText: correct }
}

// 字母关：给大写选小写（四选一）
export function generateLetterQuestions(seed: number, from: number, to: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const picked = shuffle(LETTERS.slice(from, to), rng)
  return picked.slice(0, Math.min(count, picked.length)).map((upper, index) => {
    const correct = upper.toLowerCase()
    const lowers = LETTERS.map((l) => l.toLowerCase())
    return toChoice(index, `大写 ${upper} 的小写是哪个？`, correct, lowers, rng)
  })
}

// 主题词库：[英文, 中文]。来源：上教社2024新版《英语》二年级上册官方词汇表
// （2025秋启用，课本附录照片 docs/ref/english_g2.1.jpg / english_g2.2.jpg 转录，
//  见 docs/curriculum/english.md）。关卡 ID 沿用旧主题（进度/星级记录不受影响）。
const VOCAB: Record<string, { title: string; words: Array<[string, string]> }> = {
  'eng-greet': {
    title: 'Unit 1 Hello!（问候）',
    words: [
      ['morning', '早晨；上午'], ['hi', '喂'], ['no', '不；不对'],
      ['Ms', '女士'], ['yes', '对；是'],
    ],
  },
  'eng-school': {
    title: 'Unit 2 Come and play!（学校）',
    words: [
      ['classroom', '教室'], ['welcome', '欢迎'], ['clean', '打扫'],
      ['paper', '纸'], ['let us', '让我们'], ['tidy', '整理'],
    ],
  },
  'eng-body': {
    title: 'Unit 3 I love Dad and Mum.（家人）',
    words: [
      ['dad', '爸爸'], ['mum', '妈妈'], ['father', '父亲；爸爸'],
      ['mother', '母亲；妈妈'], ['family', '家；家庭'], ['smile', '微笑'],
      ['cook', '烹饪；做饭'], ['plant', '种植'],
    ],
  },
  'eng-color': {
    title: 'Unit 4 Where am I?（户外）',
    words: [
      ['forest', '森林'], ['zoo', '动物园'], ['farm', '农场'],
      ['flower', '花'], ['where', '哪里'],
    ],
  },
  'eng-animal': {
    title: 'Unit 5 Lovely animals（动物）',
    words: [
      ['rabbit', '兔'], ['bird', '鸟'], ['fish', '鱼'], ['snake', '蛇'],
      ['duck', '鸭'], ['monkey', '猴'], ['panda', '熊猫'], ['elephant', '大象'],
      ['bear', '熊'], ['frog', '青蛙'], ['lovely', '可爱的'],
    ],
  },
  'eng-food': {
    title: 'Unit 6 Yummy vegetables（蔬菜）',
    words: [
      ['carrot', '胡萝卜'], ['onion', '洋葱'], ['potato', '土豆'],
      ['sweet potato', '红薯'], ['tomato', '西红柿'], ['salad', '色拉'],
      ['vegetable', '蔬菜'], ['chop', '切碎'], ['yummy', '美味的'],
    ],
  },
  'eng-toy': {
    title: 'Unit 7 Weather fun（天气）',
    words: [
      ['weather', '天气'], ['rainy', '多雨的'], ['sunny', '晴朗的'],
      ['cloudy', '多云的'], ['windy', '多风的'], ['raincoat', '雨衣'],
      ['boots', '靴子'],
    ],
  },
  'eng-clothes': {
    title: 'Unit 8 Fun with clothes（服装）',
    words: [
      ['cap', '帽子'], ['T-shirt', 'T恤（衫）'], ['coat', '外套；大衣'],
      ['socks', '袜子'], ['shoes', '鞋子'], ['dress up', '打扮'],
    ],
  },
  'eng-weather': {
    title: 'Unit 9 Big and small（大小）',
    words: [
      ['bear', '熊'], ['frog', '青蛙'], ['small', '小的'],
    ],
  },
  'eng-number': {
    title: 'Unit 10 My five senses（感官）',
    words: [
      ['ear', '耳朵'], ['eye', '眼睛'], ['hand', '手'],
      ['mouth', '嘴；口'], ['nose', '鼻子'], ['smell', '闻（气味）'],
      ['taste', '品尝'], ['touch', '触摸'],
    ],
  },
  'eng-action': {
    title: 'Unit 11 Fun on the farm（农场）',
    words: [
      ['duck', '鸭'], ['pig', '猪'], ['animal', '动物'],
      ['grass', '草；草地'], ['grow', '种植'], ['feed', '喂养'],
    ],
  },
  'eng-family': {
    title: 'Unit 12 Ready for school（上学准备）',
    words: [
      ['schoolbag', '书包'], ['pencil', '铅笔'], ['pen', '钢笔'],
      ['crayon', '彩色蜡笔（或粉笔、铅笔）'], ['ruler', '尺'],
      ['book', '书；书籍'], ['pack', '收拾（行李）'],
    ],
  },
}

export function vocabTitle(stageId: string): string {
  return VOCAB[stageId]?.title ?? ''
}

// 游乐场消消乐用：按主题关卡 id 取合并词表 [英文, 中文]
export function vocabThemes(ids: string[]): Array<[string, string]> {
  return ids.flatMap((id) => VOCAB[id]?.words ?? [])
}

// 词汇关：双向选择 —— 英译中 / 中译英 混合（种子决定顺序，可复现）
export function generateVocabQuestions(seed: number, stageId: string, count: number): Question[] {
  const theme = VOCAB[stageId]
  if (!theme) return []
  const rng = mulberry32(seed)
  const picked = shuffle(theme.words, rng).slice(0, Math.min(count, theme.words.length))
  const enPool = theme.words.map(([en]) => en)
  const zhPool = theme.words.map(([, zh]) => zh)
  return picked.map(([en, zh], index) => {
    const enToZh = rng() < 0.6 // 英译中为主，中译英为辅
    return enToZh
      ? toChoice(index, `"${withIpa(en)}" 的中文意思是？`, zh, zhPool, rng)
      : toChoice(index, `「${zh}」用英语怎么说？`, en, enPool, rng)
  })
}

// 兼容旧调用（问候灯塔关）
export function generateGreetingQuestions(seed: number, count: number): Question[] {
  return generateVocabQuestions(seed, 'eng-greet', count)
}

// 句型关：三选一填空（二年级 2A/2B 核心句型）
const SENTENCES: Array<{ text: string; correct: string; distractors: [string, string] }> = [
  { text: 'I ___ a boy.', correct: 'am', distractors: ['is', 'are'] },
  { text: 'This ___ my friend.', correct: 'is', distractors: ['am', 'are'] },
  { text: 'They ___ happy.', correct: 'are', distractors: ['is', 'am'] },
  { text: '___ can you do? I can swim.', correct: 'What', distractors: ['Who', 'How'] },
  { text: '___ old are you? I am eight.', correct: 'How', distractors: ['What', 'Who'] },
  { text: '___ is she? She is my mum.', correct: 'Who', distractors: ['What', 'How'] },
  { text: 'Can you swim? Yes, I ___.', correct: 'can', distractors: ["can't", 'do'] },
  { text: 'How ___ books? Five.', correct: 'many', distractors: ['much', 'old'] },
  { text: 'How ___ is it? Ten yuan.', correct: 'much', distractors: ['many', 'old'] },
  { text: 'I like ___. They are cute.', correct: 'pandas', distractors: ['panda', 'a panda'] },
  { text: 'Look ___ the blackboard.', correct: 'at', distractors: ['in', 'on'] },
  { text: 'Listen ___ the teacher.', correct: 'to', distractors: ['at', 'for'] },
  { text: 'It is raining. I have ___ umbrella.', correct: 'an', distractors: ['a', 'the'] },
  { text: 'This is ___ apple.', correct: 'an', distractors: ['a', 'two'] },
  { text: 'I get up ___ seven o\'clock.', correct: 'at', distractors: ['in', 'on'] },
  { text: 'Nice ___ meet you!', correct: 'to', distractors: ['too', 'two'] },
  { text: 'I can ___ a bike.', correct: 'ride', distractors: ['read', 'red'] },
  { text: 'What ___ is it? It is red.', correct: 'colour', distractors: ['time', 'animal'] },
]

export function generateSentenceQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const picked = shuffle(SENTENCES, rng).slice(0, Math.min(count, SENTENCES.length))
  return picked.map((sen, index) => {
    const options = shuffle([sen.correct, ...sen.distractors], rng)
    return { index, a: 0, b: 0, op: 'add' as const, text: `选一选：${sen.text}`, answer: 0, carry: false, options, answerText: sen.correct }
  })
}

// 反义词配对关：给单词选反义词（二年级常见形容词）
const ANTONYMS: Array<[string, string]> = [
  ['big', 'small'], ['tall', 'short'], ['long', 'short'], ['fat', 'thin'],
  ['hot', 'cold'], ['warm', 'cool'], ['clean', 'dirty'], ['new', 'old'],
  ['happy', 'sad'], ['open', 'close'], ['fast', 'slow'], ['young', 'old'],
]

export function generateAntonymQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const picked = shuffle(ANTONYMS, rng).slice(0, Math.min(count, ANTONYMS.length))
  const pool = ANTONYMS.map(([, b]) => b)
  return picked.map(([word, antonym], index) =>
    toChoice(index, `"${word}" 的反义词是哪个？`, antonym, pool, rng))
}
