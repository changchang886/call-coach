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
        catch (e) { reject(new Error('解析失败')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const { session, message } = event
  if (!session || !message) return { error: '缺少参数' }

  let history = [], turn = 0
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const doc = await cloud.database().collection('sessions').doc(session).get()
    if (!doc.data) throw new Error('not found')
    history = doc.data.history || []
    turn = (doc.data.turn || 0) + 1
  } catch (_) { return { error: '会话已过期，请重新开始' } }

  history.push({ role: 'user', content: message })

  try {
    const reply = await aiChat(history)
    history.push({ role: 'assistant', content: reply })

    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    await cloud.database().collection('sessions').doc(session).update({ data: { history, turn } })

    return { message: reply, turn }
  } catch (e) { return { error: 'AI请求失败: ' + e.message } }
}
