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
