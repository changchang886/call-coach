// 零依赖，原生 https 调用 DeepSeek
const https = require('https')

const KEY = 'sk-98dc6f4f0a0f4f819c3575546396f86c'

function aiChat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: opts.max_tokens || 400,
      temperature: opts.temperature ?? 0.7
    })
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.choices[0].message.content.trim())
        } catch (e) { reject(new Error('JSON解析失败: ' + data.slice(0, 100))) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

const SCENES = {
  salary:   { goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR',   vibe: '自信而不冒犯' },
  resign:   { goal: '体面地提出离职',         persona: '领导',       vibe: '坚定但不敌对' },
  debt:     { goal: '催朋友/同事还欠款',     persona: '朋友/同事',  vibe: '不伤和气但无法推脱' },
  leave:    { goal: '向领导请假',             persona: '领导',       vibe: '合理合法，提前安排交接' },
  overtime: { goal: '拒绝不合理加班',         persona: '领导/同事',  vibe: '坚定但有替代方案' },
  deposit:  { goal: '向房东要回押金',         persona: '房东',       vibe: '有理有据，引用合同' },
}

exports.main = async (event) => {
  const s = SCENES[event.scene]
  if (!s) return { error: '场景不存在' }

  try {
    const text = await aiChat([{ role: 'user', content: `你是电话沟通教练。生成话术剧本，JSON格式。场景：${s.goal} | 对象：${s.persona} | 基调：${s.vibe}。返回JSON：{"opening":"开场白（带【语气】标注，口语化能直接念）","main_script":["话术1","话术2","话术3"],"branches":[{"if":"如果对方说...","reply":"你这样回..."}],"closing":"结尾（带【语气】）","tips":["提示1","提示2","提示3"]}。要求：口语不书面。branches至少3个。语气标注：【平稳】【微笑】【停顿1秒】【语速放缓】【坚定】。` }], { max_tokens: 1200 })
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('JSON解析失败')
  } catch (e) {
    return { error: 'AI调用失败: ' + e.message, opening: '您好，想占用您几分钟时间聊一件事。【平稳】', main_script: ['第一点...【语气放缓】'], branches: [{ if: '对方说再考虑', reply: '我理解...【礼貌追问】' }], closing: '感谢您的时间。【微笑】', tips: ['准备好数据支撑'] }
  }
}
