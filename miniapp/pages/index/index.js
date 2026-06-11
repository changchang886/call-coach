/**
 * 最强模拟 · 首页 v3
 * 对话历史前端自管，不依赖云数据库
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
    messages: [],      // 展示用 [{role, content}]
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
      sceneKey: key, sceneName: scene.name,
      persona: scene.persona || '对方',
      messages: [], inputText: '', loadingText: '接通中...'
    })

    wx.cloud.callFunction({
      name: 'roleplayStart',
      data: { scene: key }
    }).then(res => {
      const data = res.result || {}
      if (data.error) {
        wx.showModal({ title: 'AI错误', content: data.error, showCancel: false })
        this.setData({ inChat: false, initializing: false })
        return
      }
      // 保存完整的 conversation history（含 system prompt）
      this.rpHistory = data.history || [{ role: 'system', content: '' }, { role: 'assistant', content: data.opening }]
      this.setData({
        initializing: false, loadingText: '',
        persona: data.persona || this.data.persona,
        messages: [{ role: 'assistant', content: data.opening }]
      })
    }).catch((err) => {
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
    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, inputText: '', loading: true })

    wx.cloud.callFunction({
      name: 'roleplayTurn',
      data: { history: this.rpHistory, message: text }
    }).then(res => {
      const data = res.result || {}
      if (data.error) {
        wx.showToast({ title: data.error, icon: 'none' })
        this.setData({ loading: false })
        return
      }
      // 更新 history + 展示消息
      this.rpHistory = data.history || this.rpHistory
      this.setData({
        messages: [...this.data.messages, { role: 'assistant', content: data.reply }],
        loading: false
      })
    }).catch(() => {
      wx.showToast({ title: '发送失败', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  endChat() {
    if (!this.rpHistory) return
    this.setData({ loadingText: '评分中...' })

    const fbP = wx.cloud.callFunction({
      name: 'roleplayEnd',
      data: { history: this.rpHistory, scene: this.data.sceneKey }
    })
    const scriptP = wx.cloud.callFunction({
      name: 'generateScript',
      data: { scene: this.data.sceneKey }
    })

    Promise.all([fbP, scriptP]).then(([fbRes, scriptRes]) => {
      const app = getApp()
      app.globalData.trainingResult = {
        feedback: fbRes.result || {},
        script: scriptRes.result || {}
      }
      wx.navigateTo({
        url: '/pages/result/result?scene=' + this.data.sceneKey + '&mode=trained'
      })
    }).catch(() => {
      wx.showToast({ title: '评分失败，请重试', icon: 'none' })
    })
    this.setData({ inChat: false, loadingText: '' })
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
      wx.showToast({ title: '生成失败', icon: 'none' })
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
          checkSummary: '云函数 checkConfig 未部署',
          checking: false,
        })
      })
  },
})
