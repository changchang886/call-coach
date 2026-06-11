/**
 * 最强模拟 · 首页（重构版）
 * 支持：微信原生 AI 直连 / 云函数 fallback
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
    sceneGoal: '',
    persona: '',
    messages: [],
    inputText: '',
    loadingText: '',
    checking: false,
    checkResults: [],
    checkSummary: '',
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
      sceneKey: key, sceneName: scene.name, sceneGoal: scene.goal,
      persona: scene.persona || '对方',
      messages: [], inputText: '', loadingText: '接通中...'
    })

    wx.cloud.callFunction({
      name: 'roleplayStart',
      data: { scene: key }
    }).then(res => {
      const data = res.result || {}
      if (data.error) {
        wx.showToast({ title: data.error, icon: 'none' })
        this.setData({ inChat: false, initializing: false })
        return
      }
      this.rpSession = data.session
      this.setData({
        initializing: false, loadingText: '',
        messages: [{ role: 'assistant', content: data.message }]
      })
    }).catch(() => {
      wx.showToast({ title: '请求失败，请重试', icon: 'none' })
      this.setData({ inChat: false, initializing: false })
    })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || !this.rpSession || this.data.loading) return
    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, inputText: '', loading: true })

    wx.cloud.callFunction({
      name: 'roleplayTurn',
      data: { session: this.rpSession, message: text }
    }).then(res => {
      const data = res.result || {}
      if (data.error) {
        wx.showToast({ title: data.error, icon: 'none' })
        this.setData({ loading: false })
        return
      }
      this.setData({
        messages: [...this.data.messages, { role: 'assistant', content: data.message }],
        loading: false
      })
    }).catch(() => {
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  endChat() {
    if (!this.rpSession) return
    this.setData({ loadingText: '评分中...' })

    const fbP = wx.cloud.callFunction({ name: 'roleplayEnd', data: { session: this.rpSession } })
    const scriptP = wx.cloud.callFunction({ name: 'generateScript', data: { scene: this.data.sceneKey } })

    Promise.all([fbP, scriptP]).then(([fbRes, scriptRes]) => {
      const app = getApp()
      app.globalData.trainingResult = {
        feedback: fbRes.result || {},
        script: scriptRes.result || {}
      }
      wx.navigateTo({
        url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=trained'
      })
      this.setData({ inChat: false, loadingText: '' })
    }).catch(() => {
      wx.showToast({ title: '评分失败，请重试', icon: 'none' })
      this.setData({ loadingText: '' })
    })
  },

  skipChat() {
    this.setData({ loadingText: '生成话术中...' })
    wx.cloud.callFunction({
      name: 'generateScript',
      data: { scene: this.data.sceneKey }
    }).then(res => {
      const app = getApp()
      app.globalData.trainingResult = {
        feedback: null,
        script: res.result || {}
      }
      wx.navigateTo({
        url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=skip'
      })
      this.setData({ inChat: false, loadingText: '' })
    }).catch(() => {
      wx.showToast({ title: '生成失败，请重试', icon: 'none' })
      this.setData({ loadingText: '' })
    })
  },

  goBack() {
    this.setData({ inChat: false, messages: [], inputText: '', loadingText: '' })
  },

  runCheck() {
    this.setData({ checking: true, checkResults: [], checkSummary: '' })
    wx.cloud.callFunction({ name: 'checkConfig' })
      .then(res => {
        const data = res.result || {}
        this.setData({
          checkResults: data.results || [],
          checkSummary: data.summary || '',
          checking: false,
        })
      })
      .catch(e => {
        this.setData({
          checkResults: [{ check: '调用失败', status: '❌', detail: e.message }],
          checkSummary: '云函数 checkConfig 未部署，右键上传',
          checking: false,
        })
      })
  },
})
