require('../common/regl')({
  extensions: [],
  onDone: (err, regl) => {
    if (err) {
      console.log(err)
      return
    }

    const setupScene = require('./scene')(regl)
    const drawBackground = require('./background')(regl)
    const drawDust = require('./dust')(regl)
    const withFullScreenQuad = require('./full-screen-quad')(regl)
    const { texture, frameBuffer } = require('./initial-texture')(regl, withFullScreenQuad)
    const computeReactionDiffusion = require('./compute-reaction-diffusion')(regl, texture)
    const drawSphere = require('./sphere')(regl, texture)
    const clear = { depth: 1, color: [0, 0, 0, 1] }
    const computeCycles = createComputeCycles()
    const computeProps = { tick: 0 }

    const frameLoop = regl.frame(({viewportWidth, viewportHeight}) => {
      try {
        computeCycles.adjust()

        withFullScreenQuad(() => {
          frameBuffer.use(() => {
            regl.clear({ color: [0, 0, 0, 1] })
            for (let i = 0; i < computeCycles.count; i++) {
              computeProps.tick++
              computeReactionDiffusion(computeProps)
              texture({ copy: true })
            }
          })
          regl.clear(clear)
          setupScene(({time}) => {
            drawSphere()
            drawBackground()
            drawDust()
          })
        })

        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})

/**
 * Function that allows for a timed number of compute cycles that fit within
 * a certain frame budget.
 */
function createComputeCycles () {
  let lastTime = Date.now()
  const computeCycles = {
    count: 10,
    adjust: () => {
      const dt = Date.now() - lastTime
      if (dt < 20) {
        computeCycles.count++
      } else if(dt > 30) {
        computeCycles.count--
      }
      computeCycles.count = Math.max(5, computeCycles.count)
      lastTime = Date.now()
    }
  }
  return computeCycles
}
