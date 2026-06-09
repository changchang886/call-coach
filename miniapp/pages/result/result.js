// 云函数调用封装
function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data || {}
    }).then(res => {
      if (res.result && res.result.error) {
        reject(new Error(res.result.error))
      } else {
        resolve(res.result)
      }
    }).catch(reject)
  })
}

Page({
  data: {
    sceneKey: '',
    sceneName: '',
    score: null,
    summary: '',
    goodPoints: [],
    improvePoints: [],
    script: null
  },

  onLoad(options) {
    const app = getApp()
    const result = app.globalData?.trainingResult

    this.setData({ sceneKey: options.scene, sceneName: options.scene || '' })

    if (options.mode === 'trained' && result) {
      const fb = result.feedback || {}
      this.setData({
        score: fb.score ?? null,
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
      const script = await callCloud('generateScript', { scene: this.data.sceneKey })
      this.setData({ script })
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  goHome() {
    wx.redirectTo({ url: '/pages/index/index' })
  }
})
