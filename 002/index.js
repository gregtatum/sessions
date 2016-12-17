const regl = require('../common/regl')()

const scene = require('./scene')()
const drawGrid = require('./grid')(regl)
const drawBeams = require('./beams')(regl)
const drawSky = require('./sky')(regl)

regl.frame(() => {
  regl.clear({ depth: 1, color: [0, 0, 0, 1] })
  drawSky(scene)
  drawGrid(scene)
  drawBeams(scene)
  window.frameDone()
})
