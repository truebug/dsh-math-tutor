// 推荐规则月度 review 报告（roadmap P3 闭环动作）
// 读本机 localStorage 导出的画像 JSON（或服务器 profile 文档），输出规则有效性摘要
// 用法：node scripts/recommend-review.mjs [profile-data.json]
// 无参数时生成模板报告（供家长把看板"导出画像"的 JSON 贴进来）
import { readFileSync } from 'node:fs'

const file = process.argv[2]
let pd = null
if (file) pd = JSON.parse(readFileSync(file, 'utf-8'))

console.log('# 推荐规则月度 Review 报告')
console.log(`生成时间：${new Date().toISOString().slice(0, 10)}`)
console.log()

if (!pd?.metrics) {
  console.log('> 未提供画像数据。从看板页导出画像 JSON 后重跑：')
  console.log('> node scripts/recommend-review.mjs <profile-data.json>')
  console.log()
  console.log('## 检查清单（人工 + AI 联合 review 用）')
  console.log('- [ ] 推荐采纳率是否 ≥60%？低于则检查推荐文案/推荐关难度是否匹配')
  console.log('- [ ] 反哺命中率是否 ≥70%？低于则放宽自适应触发阈值（正确率 80%→75%）')
  console.log('- [ ] 错因 Top1 是否连续两月不变？不变说明推荐关没有打中薄弱点')
  console.log('- [ ] 连续打卡中断点集中在周几？考虑该日降低题量')
  process.exit(0)
}

const m = pd.metrics
const rec = m.recShown > 0 ? (m.recAdopted / m.recShown * 100).toFixed(1) : null
const hit = m.adaptShown > 0 ? (m.adaptHit / m.adaptShown * 100).toFixed(1) : null
console.log(`## 累计指标`)
console.log(`- 推荐采纳率：${rec ?? '无数据'}%（${m.recAdopted}/${m.recShown}）${rec !== null && rec < 60 ? ' ⚠️ 低于 60% 阈值' : ''}`)
console.log(`- 反哺命中率：${hit ?? '无数据'}%（${m.adaptHit}/${m.adaptShown}）${hit !== null && hit < 70 ? ' ⚠️ 低于 70% 阈值' : ''}`)
const p = pd.patterns ?? {}
const total = (p.sign ?? 0) + (p.carry ?? 0) + (p.calc ?? 0) + (p.word ?? 0)
if (total > 0) {
  const labels = { sign: '看错符号', carry: '进退位失误', calc: '计算错误', word: '字词记忆' }
  const top = Object.entries(p).sort((a, b) => b[1] - a[1])[0]
  console.log(`- 错因 Top1：${labels[top[0]] ?? top[0]}（${top[1]}/${total}）`)
}
console.log()
console.log('## 行动建议')
if (rec !== null && rec < 60) console.log('- 推荐采纳率低：检查推荐关难度是否超出孩子当前水平，或推荐文案不够吸引')
if (hit !== null && hit < 70) console.log('- 反哺命中率低：自适应加量后正确率仍不达标，考虑降低 carryRatio 增幅')
if (rec !== null && rec >= 60 && hit !== null && hit >= 70) console.log('- 指标健康，规则维持现状，下月复看')
