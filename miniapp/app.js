/**
 * 最强对话 App（重构版）
 * 支持微信原生 AI + 云开发双通道
 */
const CLOUD_ENV = 'cloudbase-d6gywfjz3008a9c0b'

App({
  globalData: {
    cloudEnv: CLOUD_ENV,
    aiEnabled: false,  // 标记微信原生 AI 是否可用
  },

  onLaunch() {
    console.log('📞 最强对话 v2 启动')

    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
    }

    // 检测微信原生 AI 是否可用
    if (wx.ai && wx.ai.chat) {
      this.globalData.aiEnabled = true
      console.log('✅ 微信原生 AI 已启用')
    } else {
      console.log('⚡ 云函数模式（微信 AI 不可用）')
    }
  },
})
