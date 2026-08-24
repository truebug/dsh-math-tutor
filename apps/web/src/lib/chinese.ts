// 语文大陆内容生成器：看拼音写词语 / 看词语选拼音（双向选择题，种子可复现）
// 词表依据：部编版（统编教材）二年级上册《词语表》（课文 1-14，实体书拍照核实，
// TapXWorld/ChinaTextbook PDF 版交叉确认），见 docs/curriculum/chinese.md
import { mulberry32, type Question } from '@dsh-math-tutor/math-generator/core'

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

// 主题词库：[词语, 拼音]。来源：部编版二年级上册词语表
const THEMES: Record<string, { title: string; words: Array<[string, string]> }> = {
  'chi-nature': {
    title: '自然篇',
    words: [
      ['天空', 'tiān kōng'], ['江河', 'jiāng hé'], ['海洋', 'hǎi yáng'], ['田地', 'tián dì'],
      ['花朵', 'huā duǒ'], ['冬天', 'dōng tiān'], ['工作', 'gōng zuò'], ['办法', 'bàn fǎ'],
      ['知识', 'zhī shi'], ['人们', 'rén men'], ['平常', 'píng cháng'], ['孩子', 'hái zi'],
    ],
  },
  'chi-school': {
    title: '校园篇',
    words: [
      ['花园', 'huā yuán'], ['石桥', 'shí qiáo'], ['队旗', 'duì qí'], ['铜号', 'tóng hào'],
      ['红领巾', 'hóng lǐng jīn'], ['欢笑', 'huān xiào'], ['孔雀', 'kǒng què'], ['锦鸡', 'jǐn jī'],
      ['雄鹰', 'xióng yīng'], ['大雁', 'dà yàn'], ['熊猫', 'xióng māo'], ['朋友', 'péng you'],
    ],
  },
  'chi-tree': {
    title: '树木篇',
    words: [
      ['杨树', 'yáng shù'], ['松柏', 'sōng bǎi'], ['梧桐', 'wú tóng'], ['木棉', 'mù mián'],
      ['水杉', 'shuǐ shān'], ['化石', 'huà shí'], ['金桂', 'jīn guì'], ['四季', 'sì jì'],
      ['农事', 'nóng shì'], ['月光', 'yuè guāng'], ['辛苦', 'xīn kǔ'], ['棉衣', 'mián yī'],
    ],
  },
  'chi-home': {
    title: '家乡篇',
    words: [
      ['台湾', 'tái wān'], ['美丽', 'měi lì'], ['中华', 'zhōng huá'], ['城市', 'chéng shì'],
      ['山坡', 'shān pō'], ['枝叶', 'zhī yè'], ['展开', 'zhǎn kāi'], ['好客', 'hào kè'],
      ['水分', 'shuǐ fèn'], ['空气', 'kōng qì'], ['五光十色', 'wǔ guāng shí sè'], ['中央', 'zhōng yāng'],
    ],
  },
  'chi-mist': {
    title: '雾与风',
    words: [
      ['于是', 'yú shì'], ['无论', 'wú lùn'],
      ['海水', 'hǎi shuǐ'], ['船只', 'chuán zhī'],
      ['远方', 'yuǎn fāng'], ['连同', 'lián tóng'],
      ['岸边', 'àn biān'], ['海岸', 'hǎi àn'],
      ['房屋', 'fáng wū'], ['街道', 'jiē dào'],
      ['桥梁', 'qiáo liáng'], ['一切', 'yī qiè'],
    ],
  },
  'chi-snow': {
    title: '雪孩子',
    words: [
      ['空地', 'kòng dì'], ['唱歌', 'chàng gē'],
      ['赶快', 'gǎn kuài'], ['旁边', 'páng biān'],
      ['火星', 'huǒ xīng'], ['连忙', 'lián máng'],
      ['浑身', 'hún shēn'], ['谢谢', 'xiè xiè'],
      ['水汽', 'shuǐ qì'], ['散步', 'sàn bù'],
      ['白云', 'bái yún'], ['美丽', 'měi lì'],
    ],
  },
  'chi-fox': {
    title: '狐狸故事',
    words: [
      ['食物', 'shí wù'], ['身边', 'shēn biān'],
      ['爪子', 'zhuǎ zi'], ['面前', 'miàn qián'],
      ['野猪', 'yě zhū'], ['往常', 'wǎng cháng'],
      ['身后', 'shēn hòu'], ['神气活现', 'shén qì huó xiàn'],
      ['信以为真', 'xìn yǐ wéi zhēn'], ['奶酪', 'nǎi lào'],
      ['公平', 'gōng píng'], ['争吵', 'zhēng chǎo'],
    ],
  },
  'chi-boat': {
    title: '友谊篇',
    words: [
      ['纸船', 'zhǐ chuán'], ['松果', 'sōng guǒ'],
      ['纸条', 'zhǐ tiáo'], ['屋顶', 'wū dǐng'],
      ['和好', 'hé hǎo'], ['高兴', 'gāo xìng'],
      ['风筝', 'fēng zhēng'], ['幸福', 'xìng fú'],
      ['田野', 'tián yě'], ['风车', 'fēng chē'],
      ['秧苗', 'yāng miáo'], ['广场', 'guǎng chǎng'],
    ],
  },
  'chi-story': {
    title: '故事篇',
    words: [
      ['坐井观天', 'zuò jǐng guān tiān'], ['井沿', 'jǐng yán'], ['口渴', 'kǒu kě'], ['无边无际', 'wú biān wú jì'],
      ['山脚', 'shān jiǎo'], ['晴朗', 'qíng lǎng'], ['将来', 'jiāng lái'], ['难过', 'nán guò'],
      ['奇怪', 'qí guài'], ['自言自语', 'zì yán zì yǔ'], ['邻居', 'lín jū'], ['感谢', 'gǎn xiè'],
    ],
  },
}

export function chineseTitle(stageId: string): string {
  return THEMES[stageId]?.title ?? ''
}

// 看拼音写词语 + 看词语选拼音：双向混合（种子决定，可复现）
export function generateChineseQuestions(seed: number, stageId: string, count: number): Question[] {
  const theme = THEMES[stageId]
  if (!theme) return []
  const rng = mulberry32(seed)
  const picked = shuffle(theme.words, rng).slice(0, Math.min(count, theme.words.length))
  const hanziPool = theme.words.map(([h]) => h)
  const pinyinPool = theme.words.map(([, p]) => p)
  return picked.map(([hanzi, pinyin], index) => {
    const pinyinToHanzi = rng() < 0.5
    return pinyinToHanzi
      ? toChoice(index, `拼音 "${pinyin}" 对应的词语是？`, hanzi, hanziPool, rng)
      : toChoice(index, `「${hanzi}」的正确拼音是？`, pinyin, pinyinPool, rng)
  })
}
// ===== 古诗补全（二上必背 4 首；每首 3 题，顺序固定便于按题号配图）=====
import { CHAR_POOL } from './chineseChars'

interface Poem { id: string; title: string; author: string; lines: string[] }
export const POEMS: Poem[] = [
  { id: 'guanquelou', title: '登鹳雀楼', author: '王之涣', lines: ['白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼'] },
  { id: 'lushan', title: '望庐山瀑布', author: '李白', lines: ['日照香炉生紫烟', '遥看瀑布挂前川', '飞流直下三千尺', '疑是银河落九天'] },
  { id: 'yesu', title: '夜宿山寺', author: '李白', lines: ['危楼高百尺', '手可摘星辰', '不敢高声语', '恐惊天上人'] },
  { id: 'chile', title: '敕勒歌', author: '北朝民歌', lines: ['敕勒川，阴山下', '天似穹庐，笼盖四野', '天苍苍，野茫茫', '风吹草低见牛羊'] },
]

// 每首取第 2/3/4 句中的关键字挖空，四选一补全
const POEM_BLANKS: Array<Array<{ line: number; char: string; distractors: [string, string, string] }>> = [
  [
    { line: 1, char: '海', distractors: ['江', '河', '湖'] },
    { line: 2, char: '穷', distractors: ['看', '望', '追'] },
    { line: 3, char: '层', distractors: ['重', '座', '级'] },
  ],
  [
    { line: 0, char: '烟', distractors: ['云', '雾', '霞'] },
    { line: 2, char: '尺', distractors: ['丈', '里', '寸'] },
    { line: 3, char: '银', distractors: ['金', '玉', '白'] },
  ],
  [
    { line: 0, char: '尺', distractors: ['丈', '米', '里'] },
    { line: 1, char: '星', distractors: ['月', '云', '灯'] },
    { line: 3, char: '惊', distractors: ['吓', '吵', '醒'] },
  ],
  [
    { line: 1, char: '野', distractors: ['地', '原', '草'] },
    { line: 2, char: '苍', distractors: ['蓝', '青', '绿'] },
    { line: 3, char: '见', distractors: ['现', '看', '望'] },
  ],
]

export function generatePoemQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const all: Array<{ poem: Poem; blank: (typeof POEM_BLANKS)[number][number] }> = []
  POEMS.forEach((poem, pi) => POEM_BLANKS[pi].forEach((blank) => all.push({ poem, blank })))
  const picked = shuffle(all, rng).slice(0, Math.min(count, all.length))
  return picked.map(({ poem, blank }, index) => {
    const lineText = poem.lines[blank.line]
    const shown = lineText.replace(blank.char, '＿')
    const options = shuffle([blank.char, ...blank.distractors], rng)
    return {
      index, a: 0, b: 0, op: 'add' as const,
      text: `《${poem.title}》「${shown}」缺哪个字？`,
      answer: 0, carry: false, options, answerText: blank.char,
    }
  })
}

// ===== 识字认读：选正确读音（字库来自已核实的二上词语表拆字）=====
export function generateCharQuestions(seed: number, count: number, from: number, to: number): Question[] {
  const rng = mulberry32(seed)
  const pool = CHAR_POOL.slice(from, to)
  const picked = shuffle(pool, rng).slice(0, Math.min(count, pool.length))
  const pyPool = CHAR_POOL.map(([, py]) => py)
  return picked.map(([hanzi, py], index) =>
    toChoice(index, `「${hanzi}」的正确读音是？`, py, pyPool, rng))
}
