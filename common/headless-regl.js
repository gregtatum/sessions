const headlessContext = require('gl')

const MAX_DRAW_CALLS = 1
const WIDTH = 1280
const HEIGHT = 720
const NOOP = () => {}

module.exports = function headlessRegl (config) {
  const gl = headlessContext(WIDTH, HEIGHT)
  const argv = require('minimist')(process.argv.slice(2))
  const timeout = argv.timeout || MAX_DRAW_CALLS

  let drawCalls = 0

  // Do some nasty stuff to mock out the DOM.
  const element = {
    style: {},
    appendChild: NOOP,
    removeChild: NOOP,
    addEventListener: NOOP,
    removeEventListener: NOOP
  }
  global.document = {
    body: element,
    createElement: () => element
  }

  global.window = {
    devicePixelRatio: 1,
    isHeadless: true,
    getComputedStyle: () => ({
      getPropertyValue: NOOP
    }),
    frameDone: () => {
      drawCalls++
      if (drawCalls === timeout) {
        require('./output-rendered-image')(gl, WIDTH, HEIGHT)
      }
    },
    addEventListener: NOOP,
    removeEventListener: NOOP,
    XMLHttpRequest: require('xmlhttprequest')
  }

  Object.assign(global, global.window)

  return Object.assign({gl}, config)
}
