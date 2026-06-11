const OpenAI = require('openai')
const AI = new OpenAI({ apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c', baseURL: 'https://api.deepseek.com' })

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
    const resp = await AI.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `你是电话沟通教练。评估模拟通话。场景：${s.goal}，对象：${s.persona}。\n\n通话记录：\n${dialogue}\n\nJSON返回：{"score":8,"good":["点1","点2"],"improve":["点1","点2"],"summary":"一句话总结"}。score满分10分。` }],
      max_tokens: 400, temperature: 0.7
    })
    const text = resp.choices[0].message.content.trim()
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
  } catch (e) { return { score: 6, good: ['完成了对话'], improve: ['网络波动，评分仅供参考'], summary: '下次再来！' } }
}
