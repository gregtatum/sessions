/* globals headlessRegl */
const regl = require('regl')

module.exports = function reglSettings (config = {}) {
  let finalConfig = config

  if (typeof headlessRegl === 'function') {
    finalConfig = headlessRegl(config)
  } else {
    window.frameDone = () => {}
  }

  return regl(finalConfig)
}
