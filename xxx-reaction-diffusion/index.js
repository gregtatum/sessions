const regl = require('../common/regl')({
  extensions: ['OES_texture_float']
})
const withFullScreenQuad = require('./full-screen-quad')(regl)
const { texture, frameBuffer } = require('./initial-texture')(regl, withFullScreenQuad)
const computeReactionDiffusion = require('./compute-reaction-diffusion')(regl, texture)
const drawReactionDiffusion = require('./draw-reaction-diffusion')(regl, texture)

regl.frame(({viewportWidth, viewportHeight}) => {
  try {
    withFullScreenQuad(() => {
      frameBuffer.resize(viewportWidth, viewportHeight)
      frameBuffer.use(() => {
        regl.clear({ color: [0, 0, 0, 1] })
        for (let i = 0; i < 20; i++) {
          computeReactionDiffusion()
          texture({ copy: true })
        }
      })
      drawReactionDiffusion()
    })
  } catch (error) {
    frameLoop.cancel()
  }
})
