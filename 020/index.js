const regl = require('../common/regl')()
const withFullScreenQuad = require('./full-screen-quad')(regl)
const { texture, frameBuffer } = require('./initial-texture')(regl, withFullScreenQuad)
const computeReactionDiffusion = require('./compute-reaction-diffusion')(regl, texture)
const drawReactionDiffusion = require('./draw-reaction-diffusion')(regl, texture)

const computeProps = { tick: 0 }
let lastTime = Date.now()
let computeCycles = 10
function adjustComputeCycles () {
  const dt = Date.now() - lastTime
  if (dt < 20) {
    computeCycles++
  } else if(dt > 30) {
    computeCycles--
  }
  computeCycles = Math.max(5, computeCycles)
  lastTime = Date.now()
}

regl.frame(({viewportWidth, viewportHeight}) => {
  adjustComputeCycles()
  try {
    withFullScreenQuad(() => {
      frameBuffer.resize(viewportWidth, viewportHeight)
      frameBuffer.use(() => {
        regl.clear({ color: [0, 0, 0, 1] })
        for (let i = 0; i < computeCycles; i++) {
          computeProps.tick++
          computeReactionDiffusion(computeProps)
          texture({ copy: true })
        }
      })
      drawReactionDiffusion()
    })
  } catch (error) {
    frameLoop.cancel()
  }
})
