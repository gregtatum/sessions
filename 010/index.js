const regl = require('../common/regl')()

const setupScene = require('./scene')(regl)
const vec3 = require('gl-vec3')

const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawOutput = require('./post-process/output')(regl, drawPass)
const drawBackground = require('./background')(regl)
const drawGrid = require('./grid')(regl)
const drawDust = require('./dust')(regl)
const drawSpheres = require('./spheres')(regl)

const clear = { depth: 1, color: [0, 0, 0, 1] }
const clearBlack = { depth: 1, color: [0, 0, 0.1, 1], framebuffer: null }
const bloomProps = {
  intensity: 0.6,
  exponent: 3
}

const frameLoop = regl.frame(() => {
  try {
    // drawScene(() => {
      regl.clear(clear)
      setupScene(({time}) => {
        // drawGrid()
        drawBackground()
        drawSpheres(time)
        drawDust()
      })
    // })

    // drawPostProcessing(({sceneFBO}) => {
    //   drawBlur({sourceFBO: sceneFBO}, ({blurFBO}) => {
    //     bloomProps.sourceFBO = sceneFBO
    //     bloomProps.blurFBO = blurFBO
    //     drawOutput(bloomProps)
    //   })
    // })

    window.frameDone()
  } catch (error) {
    console.error(error)
    frameLoop.cancel()
  }
})
