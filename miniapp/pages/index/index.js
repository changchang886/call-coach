const { SCENES } = require('../../utils/api')

Page({
  data: {
    scenes: [],
    selected: null,
    showActions: false,
    actionLabel: ''
  },

  onLoad() {
    const items = Object.entries(SCENES).map(([key, s]) => ({ key, ...s }))
    this.setData({ scenes: items })
  },

  onSceneTap(e) {
    const key = e.currentTarget.dataset.key
    const scene = SCENES[key]
    this.setData({
      selected: key,
      showActions: true,
      actionLabel: `「${scene.name.slice(2)}」`
    })
  },

  // ── 实战训练（先练再拿剧本）──
  startTraining() {
    if (!this.data.selected) return
    wx.navigateTo({
      url: `/pages/training/training?scene=${this.data.selected}&mode=train`
    })
  },

  // ── 直接生成（跳过练习）──
  generateDirect() {
    if (!this.data.selected) return
    wx.navigateTo({
      url: `/pages/result/result?scene=${this.data.selected}&mode=direct`
    })
  },

  // ── 语音复盘（录真实电话后分析）──
  startVoiceReview() {
    if (!this.data.selected) return
    wx.navigateTo({
      url: `/pages/training/training?scene=${this.data.selected}&mode=voice`
    })
  },

  onShareAppMessage() {
    return {
      title: '📞 最强模拟 — 打电话前先练一遍',
      path: '/pages/index/index'
    }
  }
})
