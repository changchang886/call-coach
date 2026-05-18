const { api, SCENES } = require('../../utils/api')

Page({
  data: {
    mode: 'input', // input | watching
    codeInput: '',
    personId: '',
    persona: '',
    messages: [],
    coachTips: [],
    tipText: '',
    active: true
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ codeInput: options.code })
      this.joinWatch()
    }
  },

  onCodeInput(e) {
    this.setData({ codeInput: e.detail.value })
  },

  onTipInput(e) {
    this.setData({ tipText: e.detail.value })
  },

  async joinWatch() {
    const code = this.data.codeInput.trim().toUpperCase()
    if (!code) return

    this.coachCode = code
    this.setData({ mode: 'watching' })
    this.poll()

    // 每 2 秒轮询
    this._timer = setInterval(() => this.poll(), 2000)
  },

  async poll() {
    if (!this.coachCode) return
    try {
      const data = await api('/api/coach/watch?code=' + this.coachCode)
      if (data.error || !data.active) {
        clearInterval(this._timer)
        this.setData({ active: false })
        return
      }
      this.setData({
        persona: data.persona,
        messages: data.messages || [],
        coachTips: data.coach_tips || []
      })
    } catch (e) {}
  },

  async sendTip() {
    const msg = this.data.tipText.trim()
    if (!msg || !this.coachCode) return

    this.setData({ tipText: '' })
    await api('/api/roleplay', {
      method: 'POST',
      data: { action: 'coach_tip', code: this.coachCode, message: msg }
    })
    wx.showToast({ title: '💡 提示已发送', icon: 'success' })
  },

  backToInput() {
    clearInterval(this._timer)
    this.setData({ mode: 'input', active: true })
  },

  onUnload() {
    clearInterval(this._timer)
  },

  onShareAppMessage() {
    return {
      title: '👀 有人在练话术，进来当教练！',
      path: `/pages/coach/coach?code=${this.coachCode}`
    }
  }
})
