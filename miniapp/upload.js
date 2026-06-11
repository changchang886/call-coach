/**
 * 自动上传小程序（miniprogram-ci）
 * 用法: node upload.js [版本号] [备注]
 */
const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

const PROJECT_PATH = __dirname
const APPID = 'wx46a1c62bedb43a2d'
const KEY_PATH = path.join(__dirname, 'private.key')

const version = process.argv[2] || '1.0.0'
const desc = process.argv[3] || 'v' + version

if (!fs.existsSync(KEY_PATH)) {
  console.error('❌ 缺少上传密钥: private.key')
  console.error('   请去 mp.weixin.qq.com → 开发 → 开发设置 → 小程序代码上传密钥 → 下载后放到项目根目录')
  process.exit(1)
}

;(async () => {
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKeyPath: KEY_PATH,
    ignores: ['node_modules/**', '.git/**', 'upload.js', 'private.key', 'package-lock.json']
  })

  console.log('📦 上传中... 版本: ' + version + '  备注: ' + desc)

  try {
    await ci.upload({
      project,
      version,
      desc,
      setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
      onProgressUpdate: console.log
    })
    console.log('✅ 上传成功！→ mp.weixin.qq.com → 版本管理 → 提交审核')
  } catch (err) {
    console.error('❌ 上传失败:', err.message)
    process.exit(1)
  }
})()
