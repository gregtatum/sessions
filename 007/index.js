const regl = require('../common/regl')({
  extensions: ['OES_texture_float', 'angle_instanced_arrays']
})

const setupScene = require('./scene')(regl)
const drawFlock = require('./flock')(regl)
const clear = { depth: 1, color: [0.075, 0.15, 0.15, 1] }

const frameLoop = regl.frame(() => {
  try {
    regl.clear(clear)
    setupScene(() => {
      drawFlock()
      window.frameDone()
    })
  } catch (error) {
    frameLoop.cancel()
  }
})
