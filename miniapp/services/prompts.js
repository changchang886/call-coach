/**
 * 所有 AI Prompt 模板集中管理
 */
const { getScene } = require('../config/scenes')

/** 角色演练 - 系统提示词 */
function roleplaySystem(sceneKey) {
  const s = getScene(sceneKey)
  if (!s) return ''
  return `你现在正在扮演${s.persona}。这是一个模拟电话通话。话题：${s.goal}。态度：${s.vibe}。你是真实的普通人，不是NPC。有顾虑、有立场、有情绪。每次回1-3句话，像真实通话。`
}

/** 角色演练 - 开场白 */
function roleplayOpening() {
  return '电话铃声响了，请接起电话。只说开场白。'
}

/** 角色演练 - 评分 */
function roleplayFeedback(sceneKey, dialogue) {
  const s = getScene(sceneKey) || { goal: '未知场景', persona: '未知' }
  return `你是电话沟通教练。评估以下模拟通话。场景：${s.goal}，对象：${s.persona}。

通话记录：
${dialogue}

请用 JSON 返回：{"score": 8, "good": ["点1","点2"], "improve": ["点1","点2"], "summary": "一句话总结"}。score 满分10分。`
}

/** 生成话术剧本 */
function generateScript(sceneKey) {
  const s = getScene(sceneKey)
  if (!s) return ''
  return `你是电话沟通教练。生成话术剧本，JSON格式。场景：${s.goal} | 对象：${s.persona} | 基调：${s.vibe}。
返回JSON：{"opening":"开场白（带【语气】标注，口语化能直接念）","main_script":["话术1","话术2","话术3"],"branches":[{"if":"如果对方说...","reply":"你这样回..."},{"if":"...","reply":"..."}],"closing":"结尾（带【语气】）","tips":["提示1","提示2","提示3"]}。
要求：话术要口语不书面。branches至少3个。语气标注：【平稳】【微笑】【停顿1秒】【语速放缓】【坚定】。`
}

module.exports = { roleplaySystem, roleplayOpening, roleplayFeedback, generateScript }
