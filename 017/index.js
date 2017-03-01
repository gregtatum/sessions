const regl = require('../common/regl')({
  extensions: ['OES_texture_float', 'angle_instanced_arrays']
})
const setupScene = require('./scene')(regl)
const clear = { depth: 1.0, color: [0, 0, 0, 1] }
const resl = require('resl')
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const drawFluid = require('./fluid')(regl)

resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/00ZBrush_RedWax.png',
      parser: (data) => regl.texture({
        data,
        mag: 'linear',
        min: 'linear',
        flipY: true
      })
    }
  },
  onDone: (assets) => {
    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(() => {
          drawFluid()
          drawBackground()
          drawDust()
        })
        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})
