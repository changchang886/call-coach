// 云函数：角色演练 - 结束 + 评分
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
  const { session } = event
  if (!session) return { error: '缺少参数' }

  let history = []
  let scene = ''

  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const doc = await cloud.database().collection('sessions').doc(session).get()
    if (doc.data) {
      history = doc.data.history || []
      scene = doc.data.scene || ''
    }
  } catch (e) {
    return { error: '会话已过期' }
  }

  const s = SCENES[scene] || { goal: '未知场景', persona: '未知' }
  const dialogue = history
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'assistant' ? '对方' : '你'}: ${m.content}`)
    .join('\n')

  try {
    const ai = getClient()
    const resp = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `你是电话沟通教练。评估以下模拟通话。场景：${s.goal}，对象：${s.persona}。\n\n通话记录：\n${dialogue}\n\n请用 JSON 返回：{"score": 8, "good": ["点1","点2"], "improve": ["点1","点2"], "summary": "一句话总结"}。score 满分10分。`
      }],
      max_tokens: 400, temperature: 0.7
    })
    const text = resp.choices[0].message.content.trim()
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const result = JSON.parse(m[0])
      // 删除会话
      try {
        const cloud2 = require('wx-server-sdk')
        cloud2.init({ env: cloud2.DYNAMIC_CURRENT_ENV })
        await cloud2.database().collection('sessions').doc(session).remove()
      } catch (_) {}
      return result
    }
    return { score: 7, good: ['你敢于开口了'], improve: ['可以更自信一些'], summary: '再接再厉！' }
  } catch (e) {
    return { score: 6, good: ['完成了对话'], improve: ['网络波动，评分仅供参考'], summary: '下次再来！' }
  }
}
