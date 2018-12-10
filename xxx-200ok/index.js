const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const drawBackground = require('./background')(regl)
const drawTriangles = require('./triangles')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

const frameLoop = regl.frame(() => {
  try {
    regl.clear(clear)
    setupScene(({time}) => {
      // drawBackground()
      drawTriangles()
    })
    window.frameDone()
  } catch (error) {
    console.error(error)
    frameLoop.cancel()
  }
})
