const { api, SCENES } = require('../../utils/api')

Page({
  data: {
    sceneKey: '',
    sceneName: '',
    persona: '',
    mode: 'train', // train | voice
    messages: [],
    inputText: '',
    loading: false,
    turnCount: 0,
    maxTurns: 5,
    showEndHint: false,
    shareCode: '',
    showShare: false,
    recording: false,
    recordTime: 0
  },

  onLoad(options) {
    const scene = SCENES[options.scene] || {}
    this.setData({
      sceneKey: options.scene,
      sceneName: scene.name || '',
      persona: scene.persona || '对方',
      mode: options.mode || 'train'
    })

    if (this.data.mode === 'train') {
      this.startSession()
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  // ── 语音模式相关 ──
  toggleRecording() {
    if (this.data.recording) {
      this.stopRecord()
    } else {
      this.startRecord()
    }
  },

  startRecord() {
    const recorder = wx.getRecorderManager()
    this.recorder = recorder

    recorder.onStart(() => {
      this.setData({ recording: true, recordTime: 0 })
      this._recordTimer = setInterval(() => {
        this.setData({ recordTime: this.data.recordTime + 1 })
      }, 1000)
    })

    recorder.onStop((res) => {
      clearInterval(this._recordTimer)
      this.setData({ recording: false })
      this._tempFilePath = res.tempFilePath
    })

    recorder.onError(() => {
      wx.showToast({ title: '录音失败', icon: 'none' })
    })

    recorder.start({ duration: 300000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
  },

  stopRecord() {
    if (this.recorder) this.recorder.stop()
  },

  // ── 训练模式 ──
  async startSession() {
    this.setData({ loading: true })
    try {
      const res = await api('/api/roleplay', {
        method: 'POST',
        data: { action: 'start', scene: this.data.sceneKey, share: true }
      })
      this.trainSession = res.session
      if (res.share_code) this.setData({ shareCode: res.share_code })

      this.setData({
        messages: [{ role: 'assistant', content: res.message }],
        loading: false
      })
    } catch (e) {
      wx.showToast({ title: '启动失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || !this.trainSession) return

    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, inputText: '', loading: true })

    const turnCount = this.data.turnCount + 1
    this.setData({ turnCount })

    try {
      const res = await api('/api/roleplay', {
        method: 'POST',
        data: { action: 'turn', session: this.trainSession, message: text }
      })

      msgs.push({ role: 'assistant', content: res.message })
      this.setData({
        messages: msgs,
        loading: false,
        showEndHint: turnCount >= this.data.maxTurns,
        coachTips: res.coach_tips || []
      })
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // ── 分享给教练 ──
  async shareToCoach() {
    if (this.data.shareCode) {
      this.setData({ showShare: true })
      return
    }
    try {
      const res = await api('/api/roleplay', {
        method: 'POST',
        data: { action: 'share', session: this.trainSession }
      })
      if (res.share_code) {
        this.setData({ shareCode: res.share_code, showShare: true })
      }
    } catch (e) {
      wx.showToast({ title: '分享失败', icon: 'none' })
    }
  },

  // ── 结束训练 ──
  async endTraining() {
    this.setData({ loading: true })
    try {
      const fbRes = await api('/api/roleplay', {
        method: 'POST',
        data: { action: 'end', session: this.trainSession }
      })

      // 同时获取完整剧本
      const scriptRes = await api('/api/generate?scene=' + this.data.sceneKey)

      // 存储结果到全局
      const app = getApp()
      app.globalData.trainingResult = {
        feedback: fbRes,
        script: scriptRes,
        scene: this.data.sceneKey
      }

      wx.redirectTo({
        url: `/pages/result/result?scene=${this.data.sceneKey}&mode=trained`
      })
    } catch (e) {
      wx.showToast({ title: '结束失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onShareAppMessage() {
    return {
      title: `我在练「${this.data.sceneName.slice(2)}」话术，帮我看看？`,
      path: `/pages/coach/coach?code=${this.data.shareCode}`
    }
  }
})
