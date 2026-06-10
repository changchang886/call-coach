const { getScene, aiChat } = require('./common')

exports.main = async (event) => {
  const s = getScene(event.scene)
  if (!s) return { error: '场景不存在' }

  const system = `你现在正在扮演${s.persona}。话题：${s.goal}。态度：${s.vibe}。你是真实的普通人不是NPC，有顾虑有立场有情绪。每次回1-3句话，像真实通话。`
  const history = [{ role: 'system', content: system }]

  try {
    const opening = await aiChat(
      [...history, { role: 'user', content: '电话铃声响了，请接起电话。只说开场白。' }],
      { max_tokens: 100, temperature: 0.9 }
    )
    history.push({ role: 'assistant', content: opening })

    // 存云数据库
    let sessionId = ''
    try {
      const cloud = require('wx-server-sdk')
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
      const db = cloud.database()
      const res = await db.collection('sessions').add({
        data: { scene: event.scene, history, turn: 0, createdAt: Date.now() }
      })
      sessionId = res._id
    } catch (_) {
      sessionId = 'local-' + Date.now()
    }

    return { session: sessionId, role: s.persona, message: opening, scene: event.scene }
  } catch (e) {
    return { error: '请求失败: ' + e.message }
  }
}
