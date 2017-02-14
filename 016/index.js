const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const clear = { depth: 1.0, color: [0, 0, 0, 1] }
const resl = require('resl')
const drawFlower = require('./draw-flower')(regl)
const drawDiscFlorets = require('./disc-florets')(regl)
const drawRayFlorets = require('./ray-florets')(regl)
const drawStem = require('./stem')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)

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
          drawFlower(assets, () => {
            drawDiscFlorets(assets)
            drawRayFlorets(assets)
            drawStem(assets)
          })
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
