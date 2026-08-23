export interface ReviewRequest {
  grade: 2 | 3 | 4 | 5
  level: 1 | 2 | 3
  total: number
  correct: number
  usedSec: number
  carryWrong: number
  plainWrong: number
  wrongExamples: string[]
  history?: string
}

export async function fetchReview(req: ReviewRequest): Promise<string> {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  })
  const data = (await res.json()) as { text?: string; error?: string }
  if (!res.ok || !data.text) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.text
}
