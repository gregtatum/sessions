const resl = require('resl')
const regl = require('../common/regl')({
  extensions: ['OES_texture_float']
})
const withFullScreenQuad = require('./full-screen-quad')(regl)
const { texture, frameBuffer } = require('./initial-texture')(regl, withFullScreenQuad)
const computeReactionDiffusion = require('./compute-reaction-diffusion')(regl, texture)
const drawReactionDiffusion = require('./draw-reaction-diffusion')(regl, texture)

resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/droplet_01.png',
      parser: (data) => regl.texture({
        data,
        mag: 'linear',
        min: 'linear',
        flipY: true
      })
    }
  },
  onDone: (assets) => {
    let computeProps = { tick: 0 }
    regl.frame(({viewportWidth, viewportHeight}) => {
      try {
        withFullScreenQuad(() => {
          frameBuffer.resize(viewportWidth, viewportHeight)
          frameBuffer.use(() => {
            regl.clear({ color: [0, 0, 0, 1] })
            for (let i = 0; i < 10; i++) {
              computeProps.tick++
              computeReactionDiffusion(computeProps)
              texture({ copy: true })
            }
          })
          drawReactionDiffusion(assets)
        })
      } catch (error) {
        frameLoop.cancel()
      }
    })
  }
});
