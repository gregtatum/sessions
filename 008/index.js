const regl = require('../common/regl')()

const setupScene = require('./scene')(regl)
const drawGrid = require('./grid')(regl)
const drawBeams = require('./beams')(regl)
const drawSky = require('./sky')(regl)
const drawSphere = require('./sphere')(regl)
const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawBloom = require('./post-process/bloom')(regl, drawPass)

const clear = { depth: 1, color: [0, 0, 0, 1] }
const clearBlack = { depth: 1, color: [0, 0, 0.1, 1], framebuffer: null }

const frameLoop = regl.frame(() => {
  try {
    drawScene(() => {
      regl.clear(clear)
      setupScene(() => {
        drawSky()
        drawGrid()
        drawSphere()
      })
    })

    drawPostProcessing(({sceneFBO}) => {
      drawBlur({sourceFBO: sceneFBO}, ({blurFBO}) => {
        drawBloom({
          sourceFBO: sceneFBO,
          blurFBO: blurFBO,
          intensity: 0.6,
          exponent: 3
        })
      })
    })

    window.frameDone()
  } catch (error) {
    console.error(error)
    frameLoop.cancel()
  }
})
