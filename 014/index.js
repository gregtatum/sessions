const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const {drawMask, maskQuads} = require('./mask')(regl)
const {drawMaskBody, maskBodyQuads} = require('./mask-body')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const maskLabels = require('./label-quads')(regl, maskBodyQuads)
const clear = { depth: 1.0, color: [0, 0, 0, 1] }

const resl = require('resl')

resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/Jade_Light.png',
      parser: (data) => regl.texture({ data })
    }
  },
  onDone: (assets) => {
    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(({time}) => {
          drawMask(assets)
          drawMaskBody()
          drawBackground()
          if (false) {
            maskLabels.drawLines()
            maskLabels.drawCellIndices()
            maskLabels.drawPositionIndicies()
          }
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
