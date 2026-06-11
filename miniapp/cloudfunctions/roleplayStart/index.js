const OpenAI = require('openai')
const AI = new OpenAI({ apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c', baseURL: 'https://api.deepseek.com' })

const SCENES = {
  salary:   { persona: '领导/HR',   goal: '和领导谈加薪/谈期望薪资', vibe: '自信而不冒犯' },
  resign:   { persona: '领导',       goal: '体面地提出离职',         vibe: '坚定但不敌对' },
  debt:     { persona: '朋友/同事',  goal: '催朋友/同事还欠款',     vibe: '不伤和气但无法推脱' },
  leave:    { persona: '领导',       goal: '向领导请假',             vibe: '合理合法，提前安排交接' },
  overtime: { persona: '领导/同事',  goal: '拒绝不合理加班',         vibe: '坚定但有替代方案' },
  deposit:  { persona: '房东',       goal: '向房东要回押金',         vibe: '有理有据，引用合同' },
}

exports.main = async (event) => {
  const s = SCENES[event.scene]
  if (!s) return { error: '场景不存在' }

  const system = { role: 'system', content: `你现在正在扮演${s.persona}。话题：${s.goal}。态度：${s.vibe}。你是真实的普通人不是NPC，有顾虑有立场有情绪。每次回1-3句话，像真实通话。` }
  const history = [system]

  try {
    const resp = await AI.chat.completions.create({
      model: 'deepseek-chat',
      messages: [...history, { role: 'user', content: '电话铃声响了，请接起电话。只说开场白。' }],
      max_tokens: 100, temperature: 0.9
    })
    const opening = resp.choices[0].message.content.trim()
    history.push({ role: 'assistant', content: opening })

    let sessionId = ''
    try {
      const cloud = require('wx-server-sdk')
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
      const db = cloud.database()
      const res = await db.collection('sessions').add({ data: { scene: event.scene, history, turn: 0, createdAt: Date.now() } })
      sessionId = res._id
    } catch (_) { sessionId = 'local-' + Date.now() }

    return { session: sessionId, role: s.persona, message: opening, scene: event.scene }
  } catch (e) {
    return { error: 'AI请求失败: ' + e.message }
  }
}
