const createPieceRing = require('geo-piecering')
const createArc = require('geo-arc')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const TAU = 6.283185307179586
const simplex = new (require('simplex-noise'))()
const lerp = require('lerp')
const SEGMENT_COUNT = 50

module.exports = function (regl) {
  const arc = createArc({
    startRadian: 0,
    endRadian: TAU,
    innerRadius: 0.18,
    outerRadius: 0.2,
    numBands: 2,
    numSlices: 128
  })

  const thinArc = createArc({
    startRadian: 0,
    endRadian: TAU,
    innerRadius: 0.98,
    outerRadius: 1,
    numBands: 2,
    numSlices: 128
  })

  const segmentArc = Array(SEGMENT_COUNT).fill().map((n, i) => {
    const startRadian = i / SEGMENT_COUNT * TAU
    const endRadian = startRadian + TAU * 0.9 / SEGMENT_COUNT
    return createArc({
      startRadian,
      endRadian,
      innerRadius: 0.29,
      outerRadius: 0.35,
      numBands: 2,
      numSlices: 128
    })
  }).reduce(combineSimplicialComplexes)

  const pieceRing = createPieceRing({
    radius: 0.5, // the radius of the piece ring
    pieceSize: TAU * 0.1, // size of the pieces
    numPieces: 8, // how many pieces to place
    quadsPerPiece: 5, // how many times the piece is split
    height: 0.2 // the height of the ring
  })

  const updateNoise = regl({
    context: {
      noise: ({time}) => {
        return Math.min(1.0,
          Math.abs(0.05 * simplex.noise2D(time * 1.3, 0)) +
          Math.abs(0.2 * simplex.noise2D(time * 0.5, 0)) +
          Math.abs(1.1 * simplex.noise2D(time * 0.2, 0))
        )
      }
    }
  })

  const drawArcMeter = regl({
    count: ({noise}) => {
      return 6 * Math.abs(Math.floor(arc.cells.length / 2.00 * noise))
    },
    attributes: {
      position: arc.positions
    },
    elements: arc.cells
  })

  const drawSegmentedArcMeter = regl({
    count: ({noise}) => Math.round(
      3 * segmentArc.cells.length * (
        Math.floor(lerp(0, SEGMENT_COUNT + 0.999, Math.abs(noise))) / SEGMENT_COUNT
      )
    ),
    attributes: {
      position: segmentArc.positions
    },
    uniforms: {
      model: ({model}) => mat4.translate([], model, [0, -0.02, 0])
    },
    elements: segmentArc.cells
  })

  const drawArc = regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      varying vec3 vColor;

      void main() {
        gl_Position = projection * view * model * vec4(position, 1.0);
        vColor = vec3(0.5, 1.0, 1.0) * (max(0.0, 1.0 - gl_Position.z) + 0.3);
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    context: {
      model: mat4.identity([])
    },
    uniforms: {
      time: ({time}) => time,
      model: regl.context('model')
    }
  })

  const drawThinArc = regl({
    uniforms: {
      model: ({model}, {scale = 1, translate = 0}) => (
        mat4.scale([], mat4.translate([], model, [0, translate, 0]), [scale, scale, scale])
      )
    },
    attributes: {
      position: thinArc.positions
    },
    elements: thinArc.cells
  })

  const drawPieceRing = regl({
    attributes: {
      position: pieceRing.positions
    },
    elements: pieceRing.cells,
    uniforms: {
      model: ({model}, {scale = 1.0, height = 1.0, translate = 0}) => (
        mat4.scale([], mat4.translate([], model, [0, translate, 0]), [scale, scale * height, scale])
      )
    }
  })

  const drawTube = tubeDrawer(drawThinArc)

  return () => {
    updateNoise(() => {
      drawArc(() => {
        drawArcMeter()
        drawSegmentedArcMeter()
        drawThinArc([
          {scale: 0.1, translate: -0.01},
          {scale: 0.25, translate: 0.01},
          {scale: 0.27, translate: 0},
          {scale: 0.5, translate: -0.01}
        ])
        drawTube()
        drawPieceRing([
          {scale: 0.9, height: 1.0, translate: -0.5},
          {scale: 0.1, height: 5.0, translate: 0.0},
          {scale: 0.1, height: 20.0, translate: 0.45},
          {scale: 2.0, height: 0.05, translate: 0.20}
        ])
      })
    })
  }
}

function tubeDrawer (drawThinArc) {
  const TUBE_ARC_TRANSLATE = 0.05
  const TUBE_ARC_COUNT = 20
  const TUBE_ARC_SCALE = 0.05

  const props = Array(TUBE_ARC_COUNT).fill().map((n, i) => ({
    scale: TUBE_ARC_SCALE,
    translate: -TUBE_ARC_TRANSLATE * (i + 1) + TUBE_ARC_COUNT * TUBE_ARC_TRANSLATE * 0.5
  }))
  return () => drawThinArc(props)
}

function combineSimplicialComplexes (a, b) {
  return mapObj(a, (aValue, key) => {
    const bValue = b[key]
    if (key === 'cells') {
      return [...aValue, ...bValue.map(cell => cell.map(index => index + a.positions.length))]
    }
    return [...aValue, ...bValue]
  })
}

function mapObj (object, fn) {
  let i = 0
  const mappedObj = {}
  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      i++
      mappedObj[key] = fn(object[key], key, i)
    }
  }
  return mappedObj
}
