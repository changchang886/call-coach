// 云函数：角色演练 - 对话回合
const OpenAI = require('openai')

function getClient() {
  return new OpenAI({
    apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c',
    baseURL: 'https://api.deepseek.com'
  })
}

exports.main = async (event) => {
  const { session, message } = event
  if (!session || !message) return { error: '缺少参数' }

  let history = []
  let turn = 0

  // 从数据库取历史
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const db = cloud.database()
    const doc = await db.collection('sessions').doc(session).get()
    if (doc.data) {
      history = doc.data.history || []
      turn = (doc.data.turn || 0) + 1
    }
  } catch (e) {
    return { error: '会话已过期，请重新开始' }
  }

  history.push({ role: 'user', content: message })

  try {
    const ai = getClient()
    const resp = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: history,
      max_tokens: 150, temperature: 0.9
    })
    const reply = resp.choices[0].message.content.trim()
    history.push({ role: 'assistant', content: reply })

    // 写回数据库
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    await cloud.database().collection('sessions').doc(session).update({
      data: { history, turn }
    })

    return { message: reply, turn }
  } catch (e) {
    return { error: '网络请求失败: ' + e.message }
  }
}
