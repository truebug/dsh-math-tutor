// LLM 质量/成本埋点：只记耗时、provider、成败与错误码，不含 prompt 与身份信息。
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.ts'

export interface LlmMetric {
  ts: string
  scene: string
  provider: string
  ok: boolean
  degraded: boolean
  ms: number
  errorCode?: string
  httpStatus?: number
}

function append(file: string, row: unknown): void {
  try {
    mkdirSync(config.dataDir, { recursive: true })
    appendFileSync(join(config.dataDir, file), JSON.stringify(row) + '\n')
  } catch { /* 埋点失败不影响主链路 */ }
}

export function logLlmMetric(m: LlmMetric): void {
  append('llm-metrics.jsonl', m)
}

export function logLlmUsage(u: { scene: string; provider: string; input?: number; output?: number; total?: number }): void {
  append('llm-usage.jsonl', { ts: new Date().toISOString(), ...u })
}

export function errorCodeOf(err: unknown): { code: string; status?: number } {
  const msg = err instanceof Error ? err.message : String(err)
  const status = /HTTP (\d{3})/.exec(msg)?.[1]
  const code = /RATE_LIMIT|429/.test(msg) ? 'rate_limit'
    : /quota|usage limit/i.test(msg) ? 'quota'
    : /abort|timeout/i.test(msg) ? 'timeout'
    : status ? `http_${status}` : 'error'
  return { code, status: status ? Number(status) : undefined }
}
