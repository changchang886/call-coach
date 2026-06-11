const OpenAI = require('openai')
const AI = new OpenAI({ apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c', baseURL: 'https://api.deepseek.com' })

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
    const resp = await AI.chat.completions.create({
      model: 'deepseek-chat', messages: history, max_tokens: 150, temperature: 0.9
    })
    const reply = resp.choices[0].message.content.trim()
    history.push({ role: 'assistant', content: reply })

    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    await cloud.database().collection('sessions').doc(session).update({ data: { history, turn } })

    return { message: reply, turn }
  } catch (e) { return { error: 'AI请求失败: ' + e.message } }
}
