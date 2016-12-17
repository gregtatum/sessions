const regl = require('regl')
const TAU = Math.PI * 2

module.exports = function reglSettings (config = {}) {
  let finalConfig = config

  if (typeof headlessRegl === 'function') {
    finalConfig = headlessRegl(config)
    global.TAU = TAU
  } else {
    window.frameDone = () => {}
    window.TAU = TAU
  }

  return regl(finalConfig)
}
