const regl = require('../common/regl')()

const setupScene = require('./scene')(regl)
const drawRing = require('./ring')(regl)
const drawPlanet = require('./planet')(regl)
const drawStars = require('./stars')(regl)
const clear = { depth: 1, color: [0.075, 0.15, 0.15, 1] }

regl.frame(() => {
  regl.clear(clear)
  setupScene(() => {
    drawStars()
    drawRing()
    drawPlanet()
    window.frameDone()
  })
})
