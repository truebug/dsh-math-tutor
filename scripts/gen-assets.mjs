#!/usr/bin/env node
// 关卡插画批量生成：离线生产 → public/stages/<id>.webp → git 提交 → 静态分发
// 用法：IMAGE_PROVIDER=doubao IMAGE_API_KEY=xxx node scripts/gen-assets.mjs [stageId...]
//   IMAGE_PROVIDER=doubao: 火山方舟 doubao-seedream（https://ark.cn-beijing.volces.com/api/v3）
//   IMAGE_PROVIDER=glm:    智谱 cogview-3（https://open.bigmodel.cn/api/paas/v4）
//   IMAGE_MODEL 可覆盖默认模型；不带参数则生成全部关卡
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const STAGES = {
  // 数学大陆
  forest: 'children storybook illustration, magical firefly forest at dusk, glowing lanterns, treasure map style, warm colors, no text',
  cave: 'children storybook illustration, echo crystal cave, sparkling gems, adventure style, soft light, no text',
  lake: 'children storybook illustration, crystal lake underwater scene, bubbles and fish, dreamy blue, no text',
  snow: 'children storybook illustration, snowy mountain peak with aurora, cute adventurer flag, no text',
  island: 'children storybook illustration, treasure island with palm trees and golden chest, sunset, no text',
  vine: 'children storybook illustration, green vine valley with cute pandas playing, bamboo, no text',
  bamboo: 'children storybook illustration, honey bamboo grove, bees and honey pots, warm yellow green, no text',
  falls: 'children storybook illustration, rainbow waterfall canyon, mist and birds, no text',
  thunder: 'children storybook illustration, purple thunder peak with lightning, brave mood, no text',
  temple: 'children storybook illustration, golden temple with treasure hall, sparkles, no text',
  meadow: 'children storybook illustration, cloud meadow with sheep and windmills, sky blue, no text',
  desert: 'children storybook illustration, desert oasis with camels and palm pond, golden hour, no text',
  volcano: 'children storybook illustration, friendly volcano with lava flowers, orange glow, no text',
  rainbow: 'children storybook illustration, rainbow spring fountain, pastel colors, no text',
  galaxy: 'children storybook illustration, starry way station in space, cute rocket, deep blue, no text',
  moon: 'children storybook illustration, moon surface town with craters and flags, silver blue, no text',
  // 语文大陆
  'chi-nature': 'chinese ink wash style children illustration, bamboo path in misty mountains, no text',
  'chi-school': 'chinese ink wash style children illustration, old academy courtyard with lanterns, no text',
  'chi-tree': 'chinese ink wash style children illustration, wutong tree study house, autumn leaves, no text',
  'chi-home': 'chinese ink wash style children illustration, jiangnan water town with bridges, no text',
  'chi-story': 'chinese ink wash style children illustration, ancient pavilion with fable animals, no text',
  'chi-mist': 'chinese ink wash style children illustration, foggy river dock with boats, no text',
  'chi-snow': 'chinese ink wash style children illustration, snow valley with a cute snowman, no text',
  'chi-fox': 'chinese ink wash style children illustration, clever fox den in forest, no text',
  'chi-boat': 'chinese ink wash style children illustration, paper boats on a stream with kites, no text',
  'chi-poem': 'chinese ink wash style children illustration, painted boat on moonlit river, poetry mood, no text',
  'chi-char1': 'chinese ink wash style children illustration, stone stele forest with carved characters, no text',
  'chi-char2': 'chinese ink wash style children illustration, thousand-character grotto cave, warm torch light, no text',
  // 英语大陆
  'eng-letters1': 'children storybook illustration, sandy beach with alphabet letter shells, sunny, no text',
  'eng-letters2': 'children storybook illustration, coral reef rocks shaped like letters, sea, no text',
  'eng-greet': 'children storybook illustration, friendly lighthouse waving hello, seagulls, no text',
  'eng-school': 'children storybook illustration, cozy stationery cottage with pencil fence, no text',
  'eng-body': 'children storybook illustration, puppet theater stage with wooden puppets, no text',
  'eng-color': 'children storybook illustration, rainbow art studio with paint splashes, no text',
  'eng-animal': 'children storybook illustration, happy animal forest gathering, lion rabbit panda, no text',
  'eng-food': 'children storybook illustration, cute food market street with burger stall, no text',
  'eng-family': 'children storybook illustration, warm family cottage with glowing windows, no text',
  'eng-toy': 'children storybook illustration, toy castle with teddy bear guards, no text',
  'eng-clothes': 'children storybook illustration, magic mirror dressing room with costumes, no text',
  'eng-weather': 'children storybook illustration, four-season windmill hill, sun rain snow wind, no text',
  'eng-number': 'children storybook illustration, number clock tower with gears, no text',
  'eng-action': 'children storybook illustration, playful sports park with running animals, no text',
  'eng-opp': 'children storybook illustration, mirror lake with upside-down reflection world, no text',
  'eng-sentence': 'children storybook illustration, sentence academy with book towers, no text',
}

const provider = process.env.IMAGE_PROVIDER ?? 'doubao'
const key = process.env.IMAGE_API_KEY
if (!key) { console.error('缺少 IMAGE_API_KEY'); process.exit(1) }
const endpoints = {
  doubao: { url: 'https://ark.cn-beijing.volces.com/api/v3/images/generations', model: process.env.IMAGE_MODEL ?? 'doubao-seedream-3-0-t2i-250415' },
  glm: { url: 'https://open.bigmodel.cn/api/paas/v4/images/generations', model: process.env.IMAGE_MODEL ?? 'cogview-3-flash' },
}
const ep = endpoints[provider]
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES)
mkdirSync('apps/web/public/stages', { recursive: true })

for (const id of ids) {
  const out = `apps/web/public/stages/${id}.webp`
  if (existsSync(out)) { console.log('skip', id); continue }
  const prompt = STAGES[id]
  if (!prompt) { console.log('未知关卡', id); continue }
  process.stdout.write(`生成 ${id} ... `)
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: ep.model, prompt, size: '1024x1024', response_format: 'url' }),
  })
  if (!res.ok) { console.log('FAIL', res.status, (await res.text()).slice(0, 200)); continue }
  const data = await res.json()
  const url = data.data?.[0]?.url
  if (!url) { console.log('FAIL 无 url'); continue }
  const img = Buffer.from(await (await fetch(url)).arrayBuffer())
  writeFileSync(`/tmp/stage-${id}.png`, img)
  execSync(`sips -s format jpeg -Z 1024 /tmp/stage-${id}.png --out ${out.replace('.webp', '.jpg')}`)
  console.log('ok')
}
console.log('完成。记得 git add apps/web/public/stages')
