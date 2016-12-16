const headlessContext = require('gl')

const MAX_DRAW_CALLS = 1
const WIDTH = 1280
const HEIGHT = 720

module.exports = function headlessRegl (config) {
  const gl = headlessContext(WIDTH, HEIGHT)
  const argv = require('minimist')(process.argv.slice(2))
  const timeout = argv.timeout || MAX_DRAW_CALLS

  let drawCalls = 0

  global.window = {
    devicePixelRatio: 1,
    isHeadless: true,
    frameDone: () => {
      drawCalls++
      if (drawCalls === timeout) {
        require('./output-rendered-image')(gl, WIDTH, HEIGHT)
      }
    }
  }
  return Object.assign({gl}, config)
}
