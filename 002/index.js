const regl = require('../common/regl')()

const scene = require('./scene')()
const drawGrid = require('./grid')(regl)
const drawBeams = require('./beams')(regl)
const drawSky = require('./sky')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }

regl.frame(() => {
  regl.clear(clear)
  drawSky(scene)
  drawGrid(scene)
  drawBeams(scene)
  window.frameDone()
})
