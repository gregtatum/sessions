const regl = require('../common/regl')()

const drawFloor = require('./floor')(regl)
const drawGrid = require('./grid')(regl)

regl.frame(() => {
  regl.clear({ color: [0, 0, 0, 1] })
  drawGrid()
  drawFloor()
  window.frameDone()
})
