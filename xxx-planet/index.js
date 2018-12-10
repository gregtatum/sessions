const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }
const resl = require('resl')
const drawTerrain = require('./terrain')(regl);

resl({
  manifest: {
    // matcapTexture: {
    //   type: 'image',
    //   src: '/common/textures/matcap/green_metallic.jpg',
    //   parser: (data) => regl.texture({ data })
    // }
  },
  onDone: (assets) => {
    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(({time}) => {
          // drawBackground()
          // drawDust()
          drawTerrain()
        })

        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})
