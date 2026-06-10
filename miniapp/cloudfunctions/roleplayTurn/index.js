const { aiChat } = require('./common')

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
  } catch (_) {
    return { error: '会话已过期，请重新开始' }
  }

  history.push({ role: 'user', content: message })

  try {
    const reply = await aiChat(history, { max_tokens: 150, temperature: 0.9 })
    history.push({ role: 'assistant', content: reply })

    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    await cloud.database().collection('sessions').doc(session).update({ data: { history, turn } })

    return { message: reply, turn }
  } catch (e) {
    return { error: '请求失败: ' + e.message }
  }
}
