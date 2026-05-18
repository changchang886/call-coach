App({
  globalData: {
    trainingResult: null,
    apiBase: 'https://4fdb48b4809be5.lhr.life'
  },

  onLaunch() {
    console.log('📞 最强模拟 启动')
  },

  // 保存训练结果（跨页面传递）
  saveTrainingResult(result) {
    this.globalData.trainingResult = result
  }
})
