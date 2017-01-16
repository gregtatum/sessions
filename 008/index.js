const regl = require('../common/regl')()

const setupScene = require('./scene')(regl)
const drawTerrain = require('./terrain')(regl)
const drawSky = require('./sky')(regl)
const drawSphere = require('./sphere')(regl)
const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawBloom = require('./post-process/bloom')(regl, drawPass)

const clear = { depth: 1, color: [0, 0, 0, 1] }
const bloomProps = {
  intensity: 0.6,
  exponent: 3
}

const frameLoop = regl.frame(() => {
  try {
    drawScene(() => {
      regl.clear(clear)
      setupScene(() => {
        drawSphere()
        drawTerrain()
        drawSky()
      })
    })

    drawPostProcessing(({sceneFBO}) => {
      drawBlur({sourceFBO: sceneFBO}, ({blurFBO}) => {
        bloomProps.sourceFBO = sceneFBO
        bloomProps.blurFBO = blurFBO
        drawBloom(bloomProps)
      })
    })

    window.frameDone()
  } catch (error) {
    console.error(error)
    frameLoop.cancel()
  }
})
