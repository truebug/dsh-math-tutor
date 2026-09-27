// 匿名访客上报：随机 UUID 存 localStorage，打开页面时上报一次
// 隐私：不含身份/IP/设备信息；访客（未建档）与建档孩子以 registered 标记区分
const KEY = 'dsh-math-tutor:visitor-id'

export function getVisitorId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export function reportVisit(registered: boolean): void {
  fetch('/api/visit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitorId: getVisitorId(), registered }),
  }).catch(() => { /* 上报失败不影响使用 */ })
}

export interface VisitStats {
  total: number
  daily: Array<{ date: string; visitors: number; registered: number }>
}

export async function fetchVisitStats(): Promise<VisitStats | null> {
  try {
    const res = await fetch('/api/visit/stats')
    if (!res.ok) return null
    return await res.json() as VisitStats
  } catch { return null }
}
