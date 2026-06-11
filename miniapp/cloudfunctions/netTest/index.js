const https = require('https')

function getJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 8000 }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ ok: true, status: res.statusCode }))
    }).on('error', e => resolve({ ok: false, error: e.message }))
     .on('timeout', () => resolve({ ok: false, error: 'timeout' }))
  })
}

function postJSON(hostname, path, body) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-98dc6f4f0a0f4f819c3575546396f86c', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body: data.slice(0, 200) }))
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
    req.write(body)
    req.end()
  })
}

exports.main = async () => {
  const results = {}

  // test 1: simple GET to public API
  results.baidu = await getJSON('https://www.baidu.com')
  // test 2: DeepSeek GET  
  results.dsGet = await getJSON('https://api.deepseek.com/v1/models')
  // test 3: DeepSeek POST
  results.dsPost = await postJSON('api.deepseek.com', '/v1/chat/completions',
    JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
  )

  return results
}
