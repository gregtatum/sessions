const regl = require('regl')()
const drawSmudgePad = require('./smudge-pad')(regl)

const frameLoop = regl.frame(() => {
  try {
    drawSmudgePad()
  } catch (error) {
    frameLoop.cancel()
  }
})
