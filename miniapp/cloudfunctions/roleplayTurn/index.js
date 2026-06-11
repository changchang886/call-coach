const https = require('https')
const KEY = 'sk-98dc6f4f0a0f4f819c3575546396f86c'

function aiChat(messages, opts = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: opts.max_tokens || 150, temperature: opts.temperature ?? 0.9 })
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

exports.main = async (event) => {
  const { history, message } = event
  if (!history || !message) return { error: '缺少参数' }

  const msgs = [...history, { role: 'user', content: message }]

  try {
    const reply = await aiChat(msgs)
    msgs.push({ role: 'assistant', content: reply })
    return { history: msgs, reply }
  } catch (e) {
    return { error: 'AI请求失败: ' + e.message }
  }
}
