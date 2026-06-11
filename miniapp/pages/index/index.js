/**
 * 最强模拟 · 首页
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
    if (!this.rpHistory) return
    this.setData({ loadingText: '评分中...' })

    Promise.all([
      wx.cloud.callFunction({ name: 'roleplayEnd', data: { history: this.rpHistory, scene: this.data.sceneKey } }),
      wx.cloud.callFunction({ name: 'generateScript', data: { scene: this.data.sceneKey } })
    ]).then(([fbRes, scriptRes]) => {
      getApp().globalData.trainingResult = {
        feedback: fbRes.result || {},
        script: scriptRes.result || {}
      }
      wx.navigateTo({ url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=trained' })
      this.setData({ inChat: false, loadingText: '' })
    }).catch(() => {
      wx.showToast({ title: '评分失败', icon: 'none' })
      this.setData({ loadingText: '' })
    })
  },

  skipChat() {
    this.setData({ loadingText: '生成话术中...' })
    wx.cloud.callFunction({ name: 'generateScript', data: { scene: this.data.sceneKey } })
      .then(res => {
        getApp().globalData.trainingResult = { feedback: null, script: res.result || {} }
        wx.navigateTo({ url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=skip' })
        this.setData({ inChat: false, loadingText: '' })
      })
      .catch(() => {
        wx.showToast({ title: '生成失败', icon: 'none' })
        this.setData({ loadingText: '' })
      })
  },

  goBack() {
    this.setData({ inChat: false, messages: [], inputText: '', loadingText: '' })
  },
})
