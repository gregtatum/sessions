const regl = require('../common/regl')({
  extensions: ['OES_texture_float']
})

const setupScene = require('./scene')(regl)
const drawWave = require('./wave')(regl)
const clear = { depth: 1, color: [0.075, 0.15, 0.15, 1] }

const frameLoop = regl.frame(() => {
  try {
    regl.clear(clear)
    setupScene(() => {
      drawWave()
      window.frameDone()
    })
  } catch (error) {
    frameLoop.cancel()
  }
})
