// 云函数：角色演练 - 开始会话
const OpenAI = require('openai')

const SCENES = {
  salary:    { name: '💰 谈薪资', goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR', vibe: '自信而不冒犯' },
  resign:    { name: '🚪 提离职', goal: '体面地提出离职', persona: '领导', vibe: '坚定但不敌对' },
  debt:      { name: '💸 催还款', goal: '催朋友/同事还欠款', persona: '朋友/同事', vibe: '不伤和气但无法推脱' },
  leave:     { name: '📅 请假', goal: '向领导请假', persona: '领导', vibe: '合理合法，提前安排交接' },
  overtime:  { name: '❌ 拒绝加班', goal: '拒绝不合理加班', persona: '领导/同事', vibe: '坚定但有替代方案' },
  deposit:   { name: '🏠 退押金', goal: '向房东要回押金', persona: '房东', vibe: '有理有据，引用合同' }
}

function getClient() {
  return new OpenAI({
    apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c',
    baseURL: 'https://api.deepseek.com'
  })
}

exports.main = async (event) => {
  const { scene } = event
  if (!scene || !SCENES[scene]) return { error: '场景不存在' }

  const s = SCENES[scene]
  const system = `你现在正在扮演${s.persona}。这是一个模拟电话通话。话题：${s.goal}。态度：${s.vibe}。你是真实的普通人，不是NPC。有顾虑、有立场、有情绪。每次回1-3句话，像真实通话。`
  const history = [{ role: 'system', content: system }]

  try {
    const ai = getClient()
    const resp = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [...history, { role: 'user', content: '电话铃声响了，请接起电话。只说开场白。' }],
      max_tokens: 100, temperature: 0.9
    })
    const opening = resp.choices[0].message.content.trim()
    history.push({ role: 'assistant', content: opening })

    // 存云数据库
    const db = require('wx-server-sdk').getDatabase ? null : null
    let sessionId = ''
    try {
      const cloud = require('wx-server-sdk')
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
      const db = cloud.database()
      const res = await db.collection('sessions').add({
        data: { scene, history, turn: 0, createdAt: Date.now() }
      })
      sessionId = res._id
    } catch (e) { sessionId = 'local-' + Date.now() }

    return { session: sessionId, role: s.persona, message: opening, scene }
  } catch (e) {
    return { error: '网络请求失败: ' + e.message }
  }
}
