const regl = require('../common/regl')({
  extensions: ['OES_texture_float'],
  onDone: (err, regl) => {
    if (err) {
      console.log(err)
      return
    }
    const setupScene = require('./scene')(regl)
    const clear = { depth: 1.0, color: [0, 0, 0, 1] }
    const resl = require('resl')
    const drawBackground = require('./background')(regl)
    const drawDust = require('./dust')(regl)
    const drawFluid = require('./fluid')(regl)

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
