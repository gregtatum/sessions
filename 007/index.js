const regl = require('../common/regl')({
  extensions: ['OES_texture_float', 'angle_instanced_arrays']
})
require('../common/soundcloud')('https://soundcloud.com/synaptyx/dark-venture')
const {setupFrameBuffer, drawPostProcessing} = require('./post-process')(regl)
const setupScene = require('./scene')(regl)
const drawFlock = require('./flock')(regl)
const drawSky = require('./sky')(regl)
const drawDust = require('./dust')(regl)
const drawGodrays = require('./godrays')(regl)
const clear = { depth: 1, color: [0.075, 0.15, 0.15, 1] }
const clearBlack = { depth: 1, color: [0, 0, 0.1, 1], framebuffer: null }

const frameLoop = regl.frame(() => {
  try {
    setupFrameBuffer(() => {
      regl.clear(clear)
      setupScene(() => {
        drawSky()
        drawDust()
        drawFlock()
        drawGodrays()
      })
    })
    regl.clear(clearBlack)
    drawPostProcessing()
    window.frameDone()
  } catch (error) {
    frameLoop.cancel()
  }
})
