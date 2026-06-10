const { getScene, aiChatJSON } = require('./common')

exports.main = async (event) => {
  const s = getScene(event.scene)
  if (!s) return { error: '场景不存在' }

  const prompt = `你是电话沟通教练。生成话术剧本，JSON格式。场景：${s.goal} | 对象：${s.persona} | 基调：${s.vibe}。
返回JSON：{"opening":"开场白（带【语气】标注，口语化能直接念）","main_script":["话术1","话术2","话术3"],"branches":[{"if":"如果对方说...","reply":"你这样回..."},{"if":"...","reply":"..."}],"closing":"结尾（带【语气】）","tips":["提示1","提示2","提示3"]}。
要求：话术口语不书面。branches至少3个。语气标注：【平稳】【微笑】【停顿1秒】【语速放缓】【坚定】。`

  try {
    return await aiChatJSON([{ role: 'user', content: prompt }])
  } catch (e) {
    return {
      opening: '您好，想占用您几分钟时间聊一件事。【平稳】',
      main_script: ['第一点，我想跟您反馈一下...【语气放缓】'],
      branches: [
        { if: '如果对方说需要再考虑', reply: '我理解需要时间，您看方便给我一个大概的时间节点吗？【礼貌追问】' },
        { if: '如果对方说现在不方便', reply: '好的，那您大概什么时候方便？【保持友好】' },
        { if: '如果对方直接拒绝', reply: '我理解您的顾虑，但我想再补充一点...【坚定但不强硬】' }
      ],
      closing: '感谢您的时间。【微笑】',
      tips: ['选对方心情好的时候打', '准备好数据支撑', '练习时注意语速']
    }
  }
}
