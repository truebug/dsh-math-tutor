// 英语大陆内容生成器：确定性出题（种子可复现，支持竞赛码/每日挑战语义）
// 词表依据：牛津上海版（一年级起点）1-2 年级主题词库（djfml/englishoxfordshanghaiedition
// 全量 1042 词带音标的 Anki 牌组交叉核对）+ 沪教版（三年级起点）教材词表，
// 见 docs/curriculum/english.md
import { mulberry32, type Question } from '@dsh-math-tutor/math-generator/core'

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

// 主题词库：[英文, 中文]。来源：牛津上海版一年级起点 1A-2B 主题单元
const VOCAB: Record<string, { title: string; words: Array<[string, string]> }> = {
  'eng-greet': {
    title: '问候与课堂用语',
    words: [
      ['hello', '你好'], ['hi', '嗨'], ['goodbye', '再见'], ['good morning', '早上好'],
      ['good afternoon', '下午好'], ['good evening', '晚上好'], ['thank you', '谢谢'],
      ['sorry', '对不起'], ['please', '请'], ['yes', '是的'], ['no', '不是'],
      ['stand up', '起立'], ['sit down', '坐下'], ['come in', '进来'], ['open the door', '开门'],
      ['close the window', '关窗'], ['look at the blackboard', '看黑板'], ['listen', '听'],
      ['here you are', '给你'], ['hurry up', '快点'],
    ],
  },
  'eng-school': {
    title: '文具与课堂',
    words: [
      ['pen', '钢笔'], ['pencil', '铅笔'], ['pencil-case', '铅笔盒'], ['ruler', '尺子'],
      ['eraser', '橡皮'], ['crayon', '蜡笔'], ['book', '书'], ['bag', '书包'],
      ['sharpener', '卷笔刀'], ['school', '学校'], ['classroom', '教室'], ['blackboard', '黑板'],
      ['door', '门'], ['window', '窗户'], ['desk', '课桌'], ['chair', '椅子'],
    ],
  },
  'eng-body': {
    title: '我的身体',
    words: [
      ['head', '头'], ['face', '脸'], ['nose', '鼻子'], ['mouth', '嘴巴'], ['eye', '眼睛'],
      ['ear', '耳朵'], ['arm', '手臂'], ['finger', '手指'], ['leg', '腿'], ['foot', '脚'],
      ['body', '身体'], ['hair', '头发'], ['hand', '手'], ['long', '长的'], ['short', '短的'],
      ['big', '大的'], ['small', '小的'],
    ],
  },
  'eng-color': {
    title: '颜色与数字',
    words: [
      ['red', '红色'], ['yellow', '黄色'], ['green', '绿色'], ['blue', '蓝色'], ['purple', '紫色'],
      ['white', '白色'], ['black', '黑色'], ['orange', '橙色'], ['pink', '粉色'], ['brown', '棕色'],
      ['one', '一'], ['two', '二'], ['three', '三'], ['four', '四'], ['five', '五'],
      ['six', '六'], ['seven', '七'], ['eight', '八'], ['nine', '九'], ['ten', '十'],
    ],
  },
  'eng-animal': {
    title: '动物朋友',
    words: [
      ['cat', '猫'], ['dog', '狗'], ['monkey', '猴子'], ['panda', '熊猫'], ['rabbit', '兔子'],
      ['duck', '鸭子'], ['pig', '猪'], ['bird', '鸟'], ['bear', '熊'], ['elephant', '大象'],
      ['mouse', '老鼠'], ['squirrel', '松鼠'], ['tiger', '老虎'], ['lion', '狮子'],
      ['zebra', '斑马'], ['giraffe', '长颈鹿'], ['fox', '狐狸'], ['goose', '鹅'],
    ],
  },
  'eng-food': {
    title: '美食与饮料',
    words: [
      ['cake', '蛋糕'], ['bread', '面包'], ['hot dog', '热狗'], ['hamburger', '汉堡包'],
      ['chicken', '鸡肉'], ['French fries', '薯条'], ['juice', '果汁'], ['milk', '牛奶'],
      ['water', '水'], ['tea', '茶'], ['apple', '苹果'], ['banana', '香蕉'],
      ['orange', '橙子'], ['pear', '梨'], ['egg', '鸡蛋'], ['pineapple', '菠萝'],
    ],
  },
  'eng-family': {
    title: '家人与人物',
    words: [
      ['mum', '妈妈'], ['mother', '母亲'], ['father', '父亲'], ['brother', '兄弟'],
      ['sister', '姐妹'], ['baby', '宝宝'], ['family', '家庭'], ['friend', '朋友'],
      ['teacher', '老师'], ['classmate', '同学'], ['doctor', '医生'], ['boy', '男孩'],
      ['girl', '女孩'], ['me', '我'], ['you', '你'], ['they', '他们'],
    ],
  },
}

export function vocabTitle(stageId: string): string {
  return VOCAB[stageId]?.title ?? ''
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
      ? toChoice(index, `"${en}" 的中文意思是？`, zh, zhPool, rng)
      : toChoice(index, `「${zh}」用英语怎么说？`, en, enPool, rng)
  })
}

// 兼容旧调用（问候灯塔关）
export function generateGreetingQuestions(seed: number, count: number): Question[] {
  return generateVocabQuestions(seed, 'eng-greet', count)
}
