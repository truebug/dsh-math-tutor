// 简易熔断：按 provider 统计连续失败。连续 3 次失败 → open 10 分钟；
// open 期间直接跳过该 provider；到期后 half-open（放一次请求，成功即 reset）。
export interface CircuitState { open: boolean; openUntil: number; failures: number; lastError?: string }

const FAIL_THRESHOLD = 3
const OPEN_MS = 10 * 60_000
const states = new Map<string, CircuitState>()

export function circuitOf(provider: string): CircuitState {
  return states.get(provider) ?? { open: false, openUntil: 0, failures: 0 }
}

export function circuitOpen(provider: string): boolean {
  const s = states.get(provider)
  if (!s) return false
  if (s.open && Date.now() >= s.openUntil) {
    // half-open：清零失败计数但不摘 open 标志，调用成功后才真正关闭
    s.failures = 0
    return false
  }
  return s.open
}

export function recordSuccess(provider: string): void {
  states.set(provider, { open: false, openUntil: 0, failures: 0 })
}

export function recordFailure(provider: string, error: string): void {
  const prev = states.get(provider) ?? { open: false, openUntil: 0, failures: 0 }
  const failures = prev.failures + 1
  const open = failures >= FAIL_THRESHOLD
  states.set(provider, {
    open,
    openUntil: open ? Date.now() + OPEN_MS : 0,
    failures,
    lastError: error.slice(0, 200),
  })
}

export function circuitSnapshot(): Record<string, CircuitState> {
  return Object.fromEntries(states)
}
