/* globals headlessRegl */
const regl = require('regl')

module.exports = function reglSettings (config = {}) {
  let finalConfig = Object.assign({
    onDone: (err) => {
      if (typeof config.onDone === 'function') {
        config.onDone.apply(this, arguments)
      }
      if (err) {
        const div = document.createElement('div')
        document.body.appendChild(div)
        div.className = 'error'

        const divInner = document.createElement('div')
        divInner.innerText = err
        div.appendChild(divInner)
      }
    }
  }, config)

  if (typeof headlessRegl === 'function') {
    finalConfig = headlessRegl(finalConfig)
  } else {
    window.frameDone = () => {}
  }

  return regl(finalConfig)
}
