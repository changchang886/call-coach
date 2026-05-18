const { api, SCENES } = require('../../utils/api')

Page({
  data: {
    sceneKey: '',
    sceneName: '',
    mode: 'trained', // trained | direct
    score: 0,
    summary: '',
    goodPoints: [],
    improvePoints: [],
    script: null,
    showPhone: true,
    showScript: false,
    phoneInput: ''
  },

  onLoad(options) {
    const app = getApp()
    const result = app.globalData?.trainingResult
    const scene = SCENES[options.scene] || {}

    this.setData({
      sceneKey: options.scene,
      sceneName: scene.name || '',
      mode: options.mode || 'direct'
    })

    if (options.mode === 'trained' && result) {
      const fb = result.feedback || {}
      this.setData({
        score: fb.score || 7,
        summary: fb.summary || '',
        goodPoints: fb.good || [],
        improvePoints: fb.improve || [],
        script: result.script
      })
    } else {
      this.loadScript()
    }
  },

  async loadScript() {
    try {
      const script = await api('/api/generate?scene=' + this.data.sceneKey)
      this.setData({ script, showPhone: true })
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  // ── 手机号收集 ──
  getPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      wx.showToast({ title: '已保存', icon: 'success' })
    }
    this.revealScript()
  },

  skipPhone() {
    this.revealScript()
  },

  revealScript() {
    this.setData({ showPhone: false, showScript: true })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return {
      title: `我在最强模拟练了「${this.data.sceneName.slice(2)}」，评分${this.data.score}/10`,
      path: '/pages/index/index'
    }
  }
})
