/**
 * 场景配置 —— 整个项目的唯一数据源
 * server.py / 云函数 / 小程序页面 都从这里引用
 */
const SCENES = {
  salary:  { emoji: '💰', name: '谈薪资',   goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR',   vibe: '自信而不冒犯' },
  resign:  { emoji: '🚪', name: '提离职',   goal: '体面地提出离职',         persona: '领导',       vibe: '坚定但不敌对' },
  debt:    { emoji: '💸', name: '催还款',   goal: '催朋友/同事还欠款',     persona: '朋友/同事',  vibe: '不伤和气但无法推脱' },
  leave:   { emoji: '📅', name: '请假',     goal: '向领导请假',             persona: '领导',       vibe: '合理合法，提前安排交接' },
  overtime:{ emoji: '❌', name: '拒绝加班', goal: '拒绝不合理加班',         persona: '领导/同事',  vibe: '坚定但有替代方案' },
  deposit: { emoji: '🏠', name: '退押金',   goal: '向房东要回押金',         persona: '房东',       vibe: '有理有据，引用合同' },
}

function getSceneList() {
  return Object.entries(SCENES).map(([key, s]) => ({
    key, emoji: s.emoji, name: s.name, goal: s.goal, persona: s.persona
  }))
}

function getScene(key) {
  return SCENES[key] || null
}

module.exports = { SCENES, getSceneList, getScene }
