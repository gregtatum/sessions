const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const mushroomMesh = require('./mushroom-mesh')()
const drawMushroom = require('./mushroom-draw')(regl, mushroomMesh)
const labels = require('./label-quads')(regl, mushroomMesh)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const drawTerrain = require('./terrain')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }
const resl = require('resl')

const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawBlur = require('./post-process/blur')(regl, drawPass)
const drawOutput = require('./post-process/output')(regl, drawPass)

const bloomProps = {
  intensity: 0.6,
  exponent: 3
}

let i = 0
resl({
  manifest: {
    matcapTexture: {
      type: 'image',
      src: '/common/textures/matcap/green_metallic.jpg',
      parser: (data) => regl.texture({ data })
    }
  },
  onDone: (assets) => {
    const baseMushroom = {
      position: [0, 0, 0],
      tiltAmount: 0.5,
      orientation: 0,
      scale: 0.8,
      assets
    }
    const mushrooms = [
      {
        position: [0, 0.05, 0],
        scale: 0.85,
        tiltAmount: 0.7,
        orientation: -0.0,
      },
      {
        position: [0.2, -0.07, 0],
        orientation: 3,
        scale: 0.6
      },
      {
        position: [0.1, -0.1, 0],
        tiltAmount: 1,
        orientation: 0.4,
        scale: 0.5
      },
      {
        position: [0.2, -0.1, 0],
        tiltAmount: 0.8,
        orientation: 2.0,
        scale: 0.5
      },
      {
        position: [0.2, -0.3, 0.2],
        tiltAmount: 0.5,
        orientation: -0.3,
        scale: 0.3
      },
      {
        position: [-0.2, -0.3, 0.2],
        tiltAmount: -0.7,
        orientation: 0.0,
        scale: 0.3
      },
      {
        position: [-0.25, -0.6, 0.45],
        tiltAmount: 0.4,
        orientation: 0.0,
        scale: 0.15
      },
      {
        position: [0.5, -0.6, -0.15],
        tiltAmount: 0.4,
        orientation: 0.3,
        scale: 0.15
      },
    ]
      .map((mushroom, id) => {
        const newMushroom = Object.assign({}, baseMushroom, mushroom)
        newMushroom.id = id
        return newMushroom
      })
    const frameLoop = regl.frame(() => {
      try {
        // if (i++ % 3 !== 0) {
        //   return
        // }
        drawScene(() => {
          regl.clear(clear)
          setupScene(({time}) => {
            mushrooms.forEach(mushroom => drawMushroom(mushroom))
            // if (true) {
            //   labels.drawLines()
            //   labels.drawCellIndices()
            //   // labels.drawPositionIndicies()
            // }
            drawTerrain()
            drawBackground()
            drawDust()
          })
        })

        drawPostProcessing(({sceneFBO}) => {
          drawOutput({sourceFBO: sceneFBO})
        })

        window.frameDone()
      } catch (error) {
        console.error(error)
        frameLoop.cancel()
      }
    })
  }
})
