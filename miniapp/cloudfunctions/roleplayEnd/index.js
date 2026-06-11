const https = require('https')
const KEY = 'sk-98dc6f4f0a0f4f819c3575546396f86c'

function aiChat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: opts.max_tokens || 400, temperature: opts.temperature ?? 0.7 })
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

function sceneDesc(key) {
  const m = { salary:'谈薪资', resign:'提离职', debt:'催还款', leave:'请假', overtime:'拒绝加班', deposit:'退押金' }
  return m[key] || key
}

exports.main = async (event) => {
  const { history, scene } = event
  if (!history || !history.length) return { error: '缺少对话记录' }

  const dialogue = history
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'assistant' ? '对方' : '你'}: ${m.content}`)
    .join('\n')

  try {
    const text = await aiChat([{
      role: 'user',
      content: `你是电话沟通教练。评估以下模拟通话。场景：${sceneDesc(scene)}。\n\n通话记录：\n${dialogue}\n\n请用 JSON 返回：{"score":8,"good":["做得好的点"],"improve":["需要改进的点"],"summary":"一句话总结"}。score 满分10分。`
    }])
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('JSON解析失败')
  } catch (e) {
    return { score: 7, good: ['你敢于开口了'], improve: ['可以更自信一些'], summary: '再接再厉！' }
  }
}
