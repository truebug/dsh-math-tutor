import { chat } from '../services/llm.ts'

// 匿名错题摘要（不含昵称等身份信息；grade 用于措辞适龄化）
export interface ReviewRequest {
  grade: 2 | 3 | 4 | 5
  level: 1 | 2 | 3
  total: number
  correct: number
  usedSec: number
  carryWrong: number      // 进位/退位题错误数（确定性统计）
  plainWrong: number      // 非进退位题错误数
  wrongExamples: string[] // 如 "48 + 37 = 正确85，孩子答 75"（最多 5 条）
}

const SYSTEM = `你是一位温柔的小学数学老师，正在给{grade}年级的孩子做口算练习点评。
要求：
1. 先说一句具体、真诚的鼓励（结合正确率，不要空洞）
2. 如果有错题，用孩子能懂的话指出错误规律（比如"进位的时候忘记加1"），并教一个小技巧
3. 全程不超过 120 字，不用任何 markdown，语气像大姐姐/大哥哥
4. 不要提"AI"、"模型"等词`

export async function buildReview(req: ReviewRequest): Promise<string> {
  const acc = Math.round((req.correct / Math.max(req.total, 1)) * 100)
  const user = [
    `练习情况：100以内加减法口算，共${req.total}题，答对${req.correct}题（${acc}%），用时${req.usedSec}秒。`,
    req.carryWrong + req.plainWrong > 0
      ? `错题中进退位题错${req.carryWrong}道，基础题错${req.plainWrong}道。错题示例：${req.wrongExamples.join('；')}`
      : '全部答对。',
  ].join('\n')
  return chat([
    { role: 'system', content: SYSTEM.replace('{grade}', String(req.grade)) },
    { role: 'user', content: user },
  ])
}
