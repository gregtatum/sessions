const regl = require('regl')({
  extensions: ['OES_texture_float']
})

const drawSmudgePad = require('./smudge-pad')(regl)

const frameLoop = regl.frame(() => {
  try {
    drawSmudgePad()
  } catch (error) {
    frameLoop.cancel()
    throw error
  }
})
