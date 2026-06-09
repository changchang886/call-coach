App({
  globalData: {
    cloudEnv: 'cloudbase-d6gywfjz3008a9c0b'
  },

  onLaunch() {
    console.log('📞 最强模拟 启动')
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-d6gywfjz3008a9c0b',
        traceUser: true
      })
      this.globalData.cloudEnv = 'cloudbase-d6gywfjz3008a9c0b'
    }
  }
})
