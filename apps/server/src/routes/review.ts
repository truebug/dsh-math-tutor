import { chat } from '../services/llm.ts'

// 匿名错题摘要（不含昵称等身份信息；grade 用于措辞适龄化）
export interface ReviewRequest {
  grade: 2 | 3 | 4 | 5
  level: 1 | 2 | 3
  subject?: 'math' | 'chinese' | 'english'   // 缺省 math，兼容旧客户端
  total: number
  correct: number
  usedSec: number
  carryWrong: number      // 进位/退位题错误数（确定性统计）
  plainWrong: number      // 非进退位题错误数
  wrongExamples: string[] // 如 "48 + 37 = 正确85，孩子答 75"（最多 5 条）
  history?: string        // 开启云端同步后携带的历史画像摘要（不含身份信息）
}

const SYSTEM_MATH = `你是一位温柔的小学数学老师，正在给{grade}年级的孩子做口算练习点评。
要求：
1. 先说一句具体、真诚的鼓励（结合正确率，不要空洞）
2. 如果有错题，用孩子能懂的话指出错误规律（比如"进位的时候忘记加1"），并教一个小技巧
3. 全程不超过 120 字，不用任何 markdown，语气像大姐姐/大哥哥
4. 不要提"AI"、"模型"等词
5. 如果给了"孩子近期情况"，点评要结合长期趋势（比如"最近进退位一直在进步"），而不只是这一次`

const SYSTEM_CHINESE = `你是一位温柔的小学语文老师，正在给{grade}年级的孩子做词语/古诗练习点评。
要求：
1. 先说一句具体、真诚的鼓励（结合正确率，不要空洞）
2. 如果有错题，用孩子能懂的话指出错误规律（比如"形近字混淆""拼音声调看错""诗句记串了"），并教一个小技巧（比如组词记忆、多读两遍）
3. 全程不超过 120 字，不用任何 markdown，语气像大姐姐/大哥哥
4. 不要提"AI"、"模型"等词
5. 如果给了"孩子近期情况"，点评要结合长期趋势，而不只是这一次`

const SYSTEM_ENGLISH = `你是一位温柔的小学英语老师，正在给{grade}年级的孩子做英语词汇/句型练习点评。
要求：
1. 先说一句具体、真诚的鼓励（结合正确率，不要空洞）
2. 如果有错题，用孩子能懂的话指出错误规律（比如"单词拼写记错""词义记混了"），并教一个小技巧（比如自然拼读、把单词放进句子里记）
3. 全程不超过 120 字，不用任何 markdown，语气像大姐姐/大哥哥，可以夹一两个简单英文单词
4. 不要提"AI"、"模型"等词
5. 如果给了"孩子近期情况"，点评要结合长期趋势，而不只是这一次`

const SYSTEMS = { math: SYSTEM_MATH, chinese: SYSTEM_CHINESE, english: SYSTEM_ENGLISH } as const

const SUBJECT_DESC = {
  math: '口算练习',
  chinese: '语文词语/古诗练习（选择题）',
  english: '英语词汇/句型练习（选择题）',
} as const

export async function buildReview(req: ReviewRequest): Promise<string> {
  const subject = req.subject ?? 'math'
  const acc = Math.round((req.correct / Math.max(req.total, 1)) * 100)
  const user = [
    `练习情况：${SUBJECT_DESC[subject]}，共${req.total}题，答对${req.correct}题（${acc}%），用时${req.usedSec}秒。`,
    subject === 'math'
      ? `错题中进退位题错${req.carryWrong}道，基础题错${req.plainWrong}道。错题示例：${req.wrongExamples.join('；')}`
      : req.wrongExamples.length > 0
        ? `错题示例：${req.wrongExamples.join('；')}`
        : '全部答对。',
    req.history ? `孩子近期情况：${req.history}` : '',
  ].join('\n')
  return chat([
    { role: 'system', content: SYSTEMS[subject].replace('{grade}', String(req.grade)) },
    { role: 'user', content: user },
  ])
}
