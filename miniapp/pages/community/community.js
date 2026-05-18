const { api, SCENES } = require('../../utils/api')

Page({
  data: {
    activeTab: 'scripts',
    scripts: [],
    stories: [],
    loading: true,
    SCENES: SCENES
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const data = await api('/api/community')
      this.setData({
        scripts: (data.scripts || []).sort((a,b) => b.votes - a.votes).slice(0, 30),
        stories: (data.stories || []).sort((a,b) => b.time - a.time).slice(0, 30),
        loading: false
      })
    } catch(e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  async vote(e) {
    const id = e.currentTarget.dataset.id
    await api('/api/vote', { method: 'POST', data: { id } })
    wx.showToast({ title: '已投票', icon: 'success' })
    this.loadData()
  },

  async replay(e) {
    const id = e.currentTarget.dataset.id
    await api('/api/replay', { method: 'POST', data: { id } })
    wx.showToast({ title: '📢 已转播', icon: 'success' })
  },

  timeAgo(ts) {
    const diff = Math.floor((Date.now()/1000) - ts)
    if (diff < 60) return '刚刚'
    if (diff < 3600) return Math.floor(diff/60) + '分钟前'
    if (diff < 86400) return Math.floor(diff/3600) + '小时前'
    return Math.floor(diff/86400) + '天前'
  }
})
