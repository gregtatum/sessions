const regl = require('../common/regl')()

const setupScene = require('./scene')(regl)
const blobPromise = require('./blob')(regl)
const drawNoise = require('./noise')(regl)
const drawBlobBits = require('./blob-bits')(regl)

const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawOutput = require('./post-process/output')(regl, drawPass)

const clear = { depth: 1, color: [0, 0, 0, 1] }
const bloomProps = {
  intensity: 0.6,
  exponent: 3
}

Promise.all([blobPromise]).then(([drawBlob]) => {
  const frameLoop = regl.frame(() => {
    try {
      drawScene(() => {
        regl.clear(clear)
        setupScene(() => {
          drawBlob()
          drawNoise()
          drawBlobBits()
        })
      })

      drawPostProcessing(({sceneFBO}) => {
        drawBlur({sourceFBO: sceneFBO}, ({blurFBO}) => {
          bloomProps.sourceFBO = sceneFBO
          bloomProps.blurFBO = blurFBO
          drawOutput(bloomProps)
        })
      })

      window.frameDone()
    } catch (error) {
      console.error(error)
      frameLoop.cancel()
    }
  })
})
