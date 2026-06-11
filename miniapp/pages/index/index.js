/**
 * 最强对话 · 首页
 */
const { getSceneList } = require('../../config/scenes')

Page({
  data: {
    scenes: [],
    inChat: false,
    initializing: false,
    loading: false,
    sceneKey: '',
    sceneName: '',
    persona: '',
    messages: [],
    inputText: '',
    loadingText: '',
  },

  onLoad() {
    this.setData({ scenes: getSceneList() })
  },

  startChat(e) {
    const key = e.currentTarget.dataset.key
    const scene = this.data.scenes.find(s => s.key === key)
    if (!scene) return

    this.setData({
      inChat: true, initializing: true,
      sceneKey: key, sceneName: scene.name,
      persona: scene.persona || '对方',
      messages: [], inputText: '', loadingText: '接通中...'
    })

    wx.cloud.callFunction({ name: 'roleplayStart', data: { scene: key } })
      .then(res => {
        const data = res.result || {}
        if (data.error) {
          wx.showModal({ title: '错误', content: data.error, showCancel: false })
          this.setData({ inChat: false, initializing: false })
          return
        }
        this.rpHistory = data.history || []
        this.setData({
          initializing: false, loadingText: '',
          persona: data.persona || this.data.persona,
          messages: [{ role: 'assistant', content: data.opening }]
        })
      })
      .catch(err => {
        wx.showModal({ title: '连接失败', content: err.message || '请确认云函数已部署', showCancel: false })
        this.setData({ inChat: false, initializing: false })
      })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || !this.rpHistory || this.data.loading) return
    this.setData({ messages: [...this.data.messages, { role: 'user', content: text }], inputText: '', loading: true })

    wx.cloud.callFunction({ name: 'roleplayTurn', data: { history: this.rpHistory, message: text } })
      .then(res => {
        const data = res.result || {}
        if (data.error) {
          wx.showToast({ title: data.error, icon: 'none' })
          this.setData({ loading: false })
          return
        }
        this.rpHistory = data.history || this.rpHistory
        this.setData({
          messages: [...this.data.messages, { role: 'assistant', content: data.reply }],
          loading: false
        })
      })
      .catch(() => {
        wx.showToast({ title: '发送失败', icon: 'none' })
        this.setData({ loading: false })
      })
  },

  endChat() {
    console.log('endChat tapped, rpHistory:', !!this.rpHistory)
    if (!this.rpHistory) {
      wx.showToast({ title: '请先开始对话', icon: 'none' })
      return
    }
    wx.showToast({ title: '评分中...', icon: 'loading', duration: 15000 })
    this.setData({ loadingText: '评分中...' })

    const safeCall = (name, data) =>
      wx.cloud.callFunction({ name, data }).then(r => r.result).catch(err => {
        console.log(name + ' failed:', err)
        return { _error: err.message || '调用失败' }
      })

    Promise.all([
      safeCall('roleplayEnd', { history: this.rpHistory, scene: this.data.sceneKey }),
      safeCall('generateScript', { scene: this.data.sceneKey })
    ]).then(([feedback, script]) => {
      wx.hideToast()
      getApp().globalData.trainingResult = { feedback, script }
      wx.navigateTo({ url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=trained' })
      this.setData({ inChat: false, loadingText: '' })
    }).catch(e => {
      wx.hideToast()
      wx.showModal({ title: '评分失败', content: (e && e.message) || '请重试', showCancel: false })
      this.setData({ loadingText: '' })
    })
  },

  skipChat() {
    console.log('skipChat tapped, sceneKey:', this.data.sceneKey)
    if (!this.data.sceneKey) {
      wx.showToast({ title: '请先选择场景', icon: 'none' })
      return
    }
    wx.showToast({ title: '生成中...', icon: 'loading', duration: 10000 })
    this.setData({ loadingText: '生成话术中...' })
    wx.cloud.callFunction({ name: 'generateScript', data: { scene: this.data.sceneKey } })
      .then(res => {
        wx.hideToast()
        getApp().globalData.trainingResult = { feedback: null, script: res.result || {} }
        wx.navigateTo({ url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=skip' })
        this.setData({ inChat: false, loadingText: '' })
      })
      .catch(e => {
        wx.hideToast()
        wx.showModal({ title: '生成失败', content: (e && e.message) || '请重试', showCancel: false })
        this.setData({ loadingText: '' })
      })
  },

  goBack() {
    this.setData({ inChat: false, messages: [], inputText: '', loadingText: '' })
  },
})
