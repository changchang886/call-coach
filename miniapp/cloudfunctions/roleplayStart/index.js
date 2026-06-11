const https = require('https')
const KEY = 'sk-98dc6f4f0a0f4f819c3575546396f86c'

function aiChat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: opts.max_tokens || 100, temperature: opts.temperature ?? 0.9 })
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data).choices[0].message.content.trim()) }
        catch (e) { reject(new Error('响应解析失败')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(body); req.end()
  })
}

const SCENES = {
  salary:   { persona: '领导/HR',   goal: '和领导谈加薪/谈期望薪资', vibe: '自信而不冒犯' },
  resign:   { persona: '领导',       goal: '体面地提出离职',         vibe: '坚定但不敌对' },
  debt:     { persona: '朋友/同事',  goal: '催朋友/同事还欠款',     vibe: '不伤和气但无法推脱' },
  leave:    { persona: '领导',       goal: '向领导请假',             vibe: '合理合法，提前安排交接' },
  overtime: { persona: '领导/同事',  goal: '拒绝不合理加班',         vibe: '坚定但有替代方案' },
  deposit:  { persona: '房东',       goal: '向房东要回押金',         vibe: '有理有据，引用合同' },
}

exports.main = async (event) => {
  const s = SCENES[event.scene]
  if (!s) return { error: '场景不存在' }

  const systemMsg = `你现在正在扮演${s.persona}。这是一个模拟电话通话。话题：${s.goal}。态度：${s.vibe}。你是真实的普通人不是NPC，有顾虑有立场有情绪。每次回1-3句话，像真实通话。`

  const history = [{ role: 'system', content: systemMsg }]

  try {
    const opening = await aiChat([...history, { role: 'user', content: '电话铃声响了，请接起电话。只说开场白。' }])
    history.push({ role: 'assistant', content: opening })
    return { history, opening, persona: s.persona }
  } catch (e) {
    // 兜底：不用 AI 也能开始
    const fallback = '喂？你好。'
    history.push({ role: 'assistant', content: fallback })
    return { history, opening: fallback, persona: s.persona }
  }
}
