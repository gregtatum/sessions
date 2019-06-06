const regl = require('../common/regl')()
const setupScene = require('./scene')(regl)
const moldMesh = require('./mold-mesh')()
const drawMold = require('./mold-draw')(regl, moldMesh)
// const labels = require('./label-quads')(regl, moldMesh)
const drawBackground = require('./background')(regl)
const drawDust = require('./dust')(regl)
const clear = { depth: 1, color: [0, 0, 0, 1] }
const resl = require('resl')

const {drawScene, drawPostProcessing} = require('./post-process')(regl)
const drawPass = require('./post-process/draw-pass')(regl)
const drawOutput = require('./post-process/output')(regl, drawPass)
const simplex = new (require('simplex-noise'))()

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
    const frameLoop = regl.frame(() => {
      try {
        // if (i++ % 3 !== 0) {
        //   return
        // }
        drawScene(props => {
          props.time += Math.sin(props.time * 1.2) * 2 + 1
          // props.time += simplex.noise2D(props.tick * 0.005, 0) * 5 + 3;

          regl.clear(clear)
          setupScene(({time}) => {
            drawMold({assets})
            // if (false) {
            //   labels.drawLines()
            //   labels.drawCellIndices()
            //   // labels.drawPositionIndicies()
            // }
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
