const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const drawCellular = require('./cellular')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

const resl = require('resl')

resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/00ZBrush_RedWax.png',
      parser: (data) => regl.texture({ data })
    }
  },
  onDone: (assets) => {
    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(({time}) => {
          drawCellular(assets)
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
