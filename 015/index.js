const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const {drawFigure, maskBodyQuads} = require('./figure')(regl)
// const maskLabels = require('./label-quads')(regl, maskQuads)
const manageAndDrawFigures = require('./figure-manager')(regl, drawFigure)
const clear = { depth: 1.0, color: [0, 0, 0, 1] }
const resl = require('resl')

resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/Gorilla-White.png',
      parser: (data) => regl.texture({
        data,
        mag: 'linear',
        min: 'linear'
      })
    }
  },
  onDone: (assets) => {
    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(({time, headModel}) => {
          manageAndDrawFigures(time, assets)
          drawBackground()
          // if (false) {
          //   maskLabels.drawLines({ model: headModel })
          //   maskLabels.drawCellIndices({ model: headModel })
          //   maskLabels.drawPositionIndicies({ model: headModel })
          // }
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
