// ── API 配置 ──
// 部署后把下面地址换成你的真实域名
const API_BASE = 'https://4fdb48b4809be5.lhr.life'

// ── 场景定义 ──
const SCENES = {
  salary: { name: '💰 谈薪资', goal: '和领导谈加薪/期望薪资', persona: '领导/HR', vibe: '自信而不冒犯', emoji: '💰' },
  resign: { name: '🚪 提离职', goal: '体面地提出离职', persona: '领导', vibe: '坚定但不敌对', emoji: '🚪' },
  debt:   { name: '💸 催还款', goal: '催朋友/同事还欠款', persona: '朋友/同事', vibe: '不伤和气但无法推脱', emoji: '💸' },
  leave:  { name: '📅 请假', goal: '向领导请假', persona: '领导', vibe: '合理合法，提前安排交接', emoji: '📅' },
  overtime: { name: '❌ 拒绝加班', goal: '拒绝不合理加班', persona: '领导/同事', vibe: '坚定但有替代方案', emoji: '❌' },
  deposit: { name: '🏠 退押金', goal: '向房东要回押金', persona: '房东', vibe: '有理有据，引用合同', emoji: '🏠' }
}

// ── API 请求 ──
function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method: options.method || 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json' },
      success: res => resolve(res.data),
      fail: reject
    })
  })
}

// ── 分享给教练 ──
function shareToCoach(sceneKey, shareCode) {
  const scene = SCENES[sceneKey]
  return {
    title: `我在练「${scene.name.slice(2)}」话术，帮我看看？`,
    path: `/pages/coach/coach?code=${shareCode}`,
    imageUrl: ''
  }
}

// ── 全局状态 ──
let globalState = {
  selectedScene: null,
  trainSession: null,
  trainCode: null,
  currentScript: null
}

module.exports = { API_BASE, SCENES, api, shareToCoach, globalState }
