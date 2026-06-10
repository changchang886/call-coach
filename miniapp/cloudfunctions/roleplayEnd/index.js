const { getScene, aiChatJSON } = require('./common')

exports.main = async (event) => {
  const { session } = event
  if (!session) return { error: '缺少参数' }

  let history = [], scene = ''
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const doc = await cloud.database().collection('sessions').doc(session).get()
    if (doc.data) { history = doc.data.history || []; scene = doc.data.scene || '' }
  } catch (_) {
    return { error: '会话已过期' }
  }

  const s = getScene(scene) || { goal: '未知场景', persona: '未知' }
  const dialogue = history
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'assistant' ? '对方' : '你'}: ${m.content}`)
    .join('\n')

  try {
    const result = await aiChatJSON(
      [{ role: 'user', content: `你是电话沟通教练。评估模拟通话。场景：${s.goal}，对象：${s.persona}。\n\n通话记录：\n${dialogue}\n\nJSON格式返回：{"score":8,"good":["点1","点2"],"improve":["点1","点2"],"summary":"一句话总结"}。score满分10分。` }],
      { max_tokens: 400, temperature: 0.7 }
    )
    // 清理会话
    try {
      const cloud2 = require('wx-server-sdk')
      cloud2.init({ env: cloud2.DYNAMIC_CURRENT_ENV })
      await cloud2.database().collection('sessions').doc(session).remove()
    } catch (_) {}
    return result
  } catch (e) {
    return { score: 6, good: ['完成了对话'], improve: ['网络波动，评分仅供参考'], summary: '下次再来！' }
  }
}
