require('../common/regl')({
  extensions: ['oes_element_index_uint'],
  onDone: (err, regl) => {
    if (err) {
      console.log(err)
      return
    }

    const setupScene = require('./scene')(regl)
    const drawSquares = require('./squares')(regl)
    const drawBackground = require('./background')(regl)
    const drawDust = require('./dust')(regl)
    const clear = { depth: 1, color: [0, 0, 0, 1] }

    const frameLoop = regl.frame(() => {
      try {
        regl.clear(clear)
        setupScene(({time}) => {
          drawSquares()
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
