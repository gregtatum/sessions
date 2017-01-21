const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const drawQuads = require('./draw-quads')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawBloom = require('./post-process/bloom')(regl, drawPass)

const bloomProps = {
  intensity: 0.6,
  exponent: 3
}

const frameLoop = regl.frame(() => {
  try {
    // drawScene(() => {
      regl.clear(clear)
      setupScene(({time}) => {
        drawQuads()
        drawBackground()
        drawDust()
      })
    // })

    // drawPostProcessing(({sceneFBO}) => {
    //   drawBloom({sourceFBO: sceneFBO})
    // })

    window.frameDone()
  } catch (error) {
    console.error(error)
    frameLoop.cancel()
  }
})
