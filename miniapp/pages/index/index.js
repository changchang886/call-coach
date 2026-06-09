// 最强模拟 · 首页逻辑
// v3: 修复所有函数绑定 + 补充 demo/skip 功能

Page({
  data: {
    scenes: [],
    inChat: false,
    initializing: false,
    sceneKey: '',
    sceneName: '',
    sceneGoal: '',
    persona: '',
    messages: [],
    inputText: '',
    loadingText: '',
    inDemo: false,
    demoSceneName: '',
    demoSceneKey: '',
    demoLoading: false,
    demoMessages: []
  },

  onLoad() {
    this.loadScenes()
  },

  loadScenes() {
    this.setData({ loadingText: '加载场景...' })
    wx.cloud.callFunction({
      name: 'getScenes',
      data: {}
    }).then(res => {
      const data = res.result || {}
      const items = []
      const scenes = data.scenes || {}
      for (const key in scenes) {
        const s = scenes[key]
        items.push({
          key: key,
          emoji: s.emoji || '📞',
          name: s.name,
          goal: s.goal,
          persona: s.persona || s.name || '对方'
        })
      }
      this.setData({ scenes: items, loadingText: '' })
    }).catch(err => {
      console.error('Failed to load scenes:', err)
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' })
    })
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
        initializing: false,
        loadingText: '',
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
    if (!text || !this.rpSession) return
    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, inputText: '' })

    wx.cloud.callFunction({
      name: 'roleplayTurn',
      data: { session: this.rpSession, message: text }
    }).then(res => {
      const data = res.result || {}
      if (data.error) {
        wx.showToast({ title: data.error, icon: 'none' })
        return
      }
      this.setData({
        messages: [...this.data.messages, { role: 'assistant', content: data.message }]
      })
    }).catch(() => {
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
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

  startDemo(e) {
    const key = e.currentTarget.dataset.key
    const scene = this.data.scenes.find(s => s.key === key)
    if (!scene) return
    this.setData({
      inDemo: true, demoLoading: true,
      demoSceneKey: key, demoSceneName: scene.name,
      demoMessages: []
    })

    wx.cloud.callFunction({
      name: 'generateScript',
      data: { scene: key }
    }).then(res => {
      const script = res.result || {}
      const persona = scene.persona || '对方'
      const msgs = []
      if (script.opening) {
        msgs.push({ speaker: persona, text: script.opening })
      }
      if (script.main_script && script.main_script.length > 0) {
        script.main_script.forEach(function(line, i) {
          msgs.push({ speaker: '你', text: line })
          const br = script.branches && script.branches[i]
          if (br) {
            msgs.push({ speaker: persona, text: br.reply || br.if || '...' })
          }
        })
      }
      if (script.closing) {
        msgs.push({ speaker: '你', text: script.closing })
      }
      this.setData({ demoMessages: msgs, demoLoading: false })
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ inDemo: false })
    })
  },

  closeDemo() {
    this.setData({ inDemo: false, demoMessages: [] })
  },

  demoThenTry() {
    const key = this.data.demoSceneKey
    const scene = this.data.scenes.find(s => s.key === key)
    this.setData({ inDemo: false })
    if (scene) {
      this.startChat({ currentTarget: { dataset: { key: key } } })
    }
  }
})
