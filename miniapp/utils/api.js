// API 层 —— 云函数封装
// v2: 从 wx.request 迁移到云开发

function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data || {}
    }).then(res => {
      if (res.result && res.result.error) {
        reject(new Error(res.result.error))
      } else {
        resolve(res.result)
      }
    }).catch(reject)
  })
}

module.exports = { callCloud }
