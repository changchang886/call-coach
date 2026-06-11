const OpenAI = require('openai')

const AI = new OpenAI({
  apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c',
  baseURL: 'https://api.deepseek.com'
})

const SCENES = {
  salary:   { goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR',   vibe: '自信而不冒犯' },
  resign:   { goal: '体面地提出离职',         persona: '领导',       vibe: '坚定但不敌对' },
  debt:     { goal: '催朋友/同事还欠款',     persona: '朋友/同事',  vibe: '不伤和气但无法推脱' },
  leave:    { goal: '向领导请假',             persona: '领导',       vibe: '合理合法，提前安排交接' },
  overtime: { goal: '拒绝不合理加班',         persona: '领导/同事',  vibe: '坚定但有替代方案' },
  deposit:  { goal: '向房东要回押金',         persona: '房东',       vibe: '有理有据，引用合同' },
}

exports.main = async (event) => {
  const s = SCENES[event.scene]
  if (!s) return { error: '场景不存在' }

  try {
    const resp = await AI.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `你是电话沟通教练。生成话术剧本，JSON格式。场景：${s.goal} | 对象：${s.persona} | 基调：${s.vibe}。返回JSON：{"opening":"开场白（带【语气】标注，口语化能直接念）","main_script":["话术1","话术2","话术3"],"branches":[{"if":"如果对方说...","reply":"你这样回..."}],"closing":"结尾（带【语气】）","tips":["提示1","提示2","提示3"]}。要求：口语不书面。branches至少3个。语气标注：【平稳】【微笑】【停顿1秒】【语速放缓】【坚定】。` }],
      max_tokens: 1200, temperature: 0.7
    })
    const text = resp.choices[0].message.content.trim()
    const m = text.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('JSON解析失败')
  } catch (e) {
    console.error('generateScript error:', e.message)
    return { opening: '您好，想占用您几分钟时间聊一件事。【平稳】', main_script: ['第一点，我想跟您反馈一下...【语气放缓】'], branches: [{ if: '对方说需要再考虑', reply: '我理解需要时间，您看方便给我一个大概的时间节点吗？【礼貌追问】' }], closing: '感谢您的时间。【微笑】', tips: ['选对方心情好的时候打', '准备好数据支撑', '练习时注意语速'] }
  }
}
