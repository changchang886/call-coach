const https = require('https')

exports.main = async () => {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '回复：好' }],
      max_tokens: 5
    })
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-98dc6f4f0a0f4f819c3575546396f86c',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ ok: true, reply: json.choices[0].message.content, model: json.model })
        } catch (e) { resolve({ ok: false, error: 'JSON解析失败', raw: data.slice(0, 200) }) }
      })
    })
    req.on('error', e => resolve({ ok: false, error: '网络错误: ' + e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '请求超时' }) })
    req.write(body)
    req.end()
  })
}
