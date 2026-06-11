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
        catch (e) { reject(new Error('解析失败')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

const SCENES = {
  salary:   { goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR' },
  resign:   { goal: '体面地提出离职',         persona: '领导' },
  debt:     { goal: '催朋友/同事还欠款',     persona: '朋友/同事' },
  leave:    { goal: '向领导请假',             persona: '领导' },
  overtime: { goal: '拒绝不合理加班',         persona: '领导/同事' },
  deposit:  { goal: '向房东要回押金',         persona: '房东' },
}

exports.main = async (event) => {
  const { session } = event
  if (!session) return { error: '缺少参数' }

  let history = [], scene = ''
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const doc = await cloud.database().collection('sessions').doc(session).get()
    if (doc.data) { history = doc.data.history || []; scene = doc.data.scene || '' }
  } catch (_) { return { error: '会话已过期' } }

  const s = SCENES[scene] || { goal: '未知场景', persona: '未知' }
  const dialogue = history.filter(m => m.role !== 'system').map(m => `${m.role === 'assistant' ? '对方' : '你'}: ${m.content}`).join('\n')

  try {
    const text = await aiChat([{ role: 'user', content: `你是电话沟通教练。评估模拟通话。场景：${s.goal}，对象：${s.persona}。\n\n通话记录：\n${dialogue}\n\nJSON返回：{"score":8,"good":["点1","点2"],"improve":["点1","点2"],"summary":"一句话总结"}。score满分10分。` }])
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const result = JSON.parse(m[0])
      try {
        const cloud2 = require('wx-server-sdk')
        cloud2.init({ env: cloud2.DYNAMIC_CURRENT_ENV })
        await cloud2.database().collection('sessions').doc(session).remove()
      } catch (_) {}
      return result
    }
    return { score: 7, good: ['你敢于开口了'], improve: ['可以更自信一些'], summary: '再接再厉！' }
  } catch (e) { return { error: 'AI请求失败: ' + e.message, score: 6, good: ['完成了对话'], improve: ['网络波动'], summary: '下次再来！' } }
}
