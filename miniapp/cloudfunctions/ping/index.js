exports.main = async () => {
  return { ok: true, time: new Date().toISOString(), node: process.version }
}
