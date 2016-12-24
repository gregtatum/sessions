const regl = require('../common/regl')({
  // extensions: ['OES_texture_float', 'angle_instanced_arrays']
})

const setupScene = require('./scene')(regl)
const drawCircles = require('./circles')(regl)
const drawDotGrid = require('./dot-grid')(regl)
const {setupFrameBuffer, drawPostProcessing} = require('./post-process')(regl)

const clearColored = { depth: 1, color: [0.035, 0.07, 0.07, 1] }
const clearBlack = { depth: 1, color: [0, 0, 0.1, 1], framebuffer: null }

const frameLoop = regl.frame(() => {
  try {
    setupFrameBuffer(() => {
      regl.clear(clearColored)
      setupScene(() => {
        drawDotGrid()
        drawCircles()
      })
    })
    regl.clear(clearBlack)
    drawPostProcessing()
    window.frameDone()
  } catch (error) {
    frameLoop.cancel()
  }
})
