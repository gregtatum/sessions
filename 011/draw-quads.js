const glsl = require('glslify')
// const DRAW_MODE = 'lines'
const DRAW_MODE = 'triangle'
const MAX_POSITIONS = 300000
const SPLIT_COUNT = 1000
const COUNT_PER_QUAD = DRAW_MODE === 'lines' ? 8 : 6
const MAX_ELEMENTS = COUNT_PER_QUAD * MAX_POSITIONS
const WIDTH = 0.3
const HEIGHT = 0.1
const TAPER = 0.25
const SPLITS_PER_DRAW = 8

const vec3 = require('gl-vec3')
const {
  splitQuadVerticalDisjoint,
  splitQuadHorizontalDisjoint,
  extrudeQuadDisjoint
} = require('./quads')

module.exports = function (regl) {
  const positionsData = new Float32Array(MAX_POSITIONS * 3)
  const normalsData = new Float32Array(MAX_POSITIONS * 3)
  const elementsData = new Uint16Array(MAX_ELEMENTS)
  const buffers = {
    positionsData,
    normalsData,
    elementsData,
    positions: regl.buffer({
      usage: 'dynamic',
      data: positionsData
    }),
    normals: regl.buffer({
      usage: 'dynamic',
      data: normalsData
    }),
    elements: regl.elements({
      usage: 'dynamic',
      data: elementsData,
      count: 0
    })
  }

  const quads = createQuads(buffers)
  const updateBuffers = quadBuffersUpdater(quads, buffers)
  const draw = createDraw(regl, buffers)
  const popExtrudes = extrudePopper(quads)

  return () => {
    let didExtrude = false
    for (let i = 0; i < SPLITS_PER_DRAW; i++) {
      didExtrude = popExtrudes()
    }
    if (didExtrude) {
      updateBuffers()
    }
    draw()
  }
}

function createDraw (regl, buffers) {
  return regl({
    /*
    vert: glsl`
      precision mediump float;
      attribute vec3 position, normal;
      uniform mat4 view, projection;
      varying vec3 vColor;

      ${lights(i => `uniform vec3 light${i};`)}
      ${lights(i => `uniform vec3 lightColor${i};`)}

      void main() {
        vec3 baseColor = vec3(1.0);
        vColor = ${lights(i => (
          `baseColor * lightColor${i} * max(0.0, dot(light${i}, normal))`
        ), ' + ')};

        gl_Position = projection * view * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `, */
    vert: glsl`
      precision mediump float;
      #pragma glslify: rotateX = require(../common/glsl/rotateX)

      attribute vec3 position, normal;
      uniform mat4 view, projection;
      uniform vec3 cameraPosition;
      uniform float fov, aspectRatio, time;
      varying vec3 vPosition, vReflect, vColor;
      varying vec2 vUv;

      ${lights(i => `uniform vec3 light${i};`)}
      ${lights(i => `uniform vec3 lightColor${i};`)}

      void main() {
        vPosition = position;
        vec3 worldPosition = position;

        float thetaX = (
          0.05 * sin(time + worldPosition.y * 300.0) +
          0.03 * sin(time * 3.0 + worldPosition.y * 500.0)
        );
        vec3 normal2 = rotateX(normal, thetaX);

        vec3 cameraToSurface = normalize(worldPosition - cameraPosition);
        vReflect = cameraToSurface - 2.0 * dot(cameraToSurface, normal2) * normal2;

        vec3 baseColor = vec3(1.0);
        vColor = ${lights(i => (
          `baseColor * lightColor${i} * max(0.0, dot(light${i}, normal2))`
        ), ' + ')};

        gl_Position = projection * view * vec4(position, 0.5);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: computeBackground = require(./background)

      varying vec3 vPosition, vReflect, vColor;
      uniform float time;

      #define PI ${Math.PI}

      void main () {
        // vec3 direction = normalize(vReflect);
        // Save on a normalization step.
        vec3 direction = vReflect;
        vec3 reflectiveColor = computeBackground(direction, time).xyz;
        vec3 color = (
          0.5 * reflectiveColor +
          0.5 * vColor
        );
        gl_FragColor = vec4(color, 1.0);
      }
    `,

    attributes: {
      position: buffers.positions,
      normal: buffers.normals
    },
    elements: buffers.elements,
    primitive: DRAW_MODE,
    cull: { enable: true }
  })
}

/**
 * -1, 1     1, 1
 *     b-----c
 *     |     |
 *     a-----d
 * -1,-1    1, -1
 */
function createQuads () {
  const w = WIDTH / 2
  const h = -HEIGHT / 2
  const quads = {
    positions: [
      [-w, h, -w],
      [-w, h, w],
      [w, h, w],
      [w, h, -w],

      [w, h, -w],
      [w, h, w],
      [-w, h, w],
      [-w, h, -w]
    ],
    normals: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, -1, 0],
      [0, -1, 0],
      [0, -1, 0]
    ],
    cells: [[0, 1, 2, 3], [4, 5, 6, 7]]
  }

  // Create a box by extruding the top facing quad, and leaving the bottom facing one.
  extrudeQuadDisjoint(quads, quads.cells[0], TAPER, HEIGHT)

  for (let i = 0; i < SPLIT_COUNT; i++) {
    let largestCell
    let largestSize = 0
    quads.cells.forEach((cell, i) => {
      if (i === 1) {
        // Skip the bottom cell
        return
      }
      const size = vec3.squaredDistance(quads.positions[cell[0]], quads.positions[cell[2]])
      if (size > largestSize) {
        largestCell = cell
        largestSize = size
      }
    })
    const xLength = vec3.squaredDistance(quads.positions[largestCell[0]], quads.positions[largestCell[3]])
    const yLength = vec3.squaredDistance(quads.positions[largestCell[0]], quads.positions[largestCell[1]])

    ;(Math.random() > 0.4 && yLength > xLength
      ? splitQuadHorizontalDisjoint
      : splitQuadVerticalDisjoint)(quads, largestCell, Math.random() * 0.25 + 0.5 - 0.125)
  }

  // quads.cells.forEach(cell => {
  //   const distance = 0.01 * Math.random()
  //   extrudeQuadDisjoint(quads, cell, 0.0, distance)
  //   extrudeQuadDisjoint(quads, cell, 0.05, distance * 0.05)
  // })

  return quads
}

function extrudePopper (quads, tick) {
  let i = 0
  // Sort cells by height, top to bottom
  const cells = quads.cells.slice().sort((a, b) => {
    return quads.positions[b[0]][1] - quads.positions[a[0]][1]
  })
  return () => {
    i++
    const cell = cells[i]
    if (cell) {
      const distance = 0.01 * Math.random()
      extrudeQuadDisjoint(quads, cell, 0.0, distance)
      extrudeQuadDisjoint(quads, cell, 0.05, distance * 0.05)
      return true
    }
  }
}

function quadBuffersUpdater (quads, buffers) {
  return () => {
    const { positionsData, normalsData, elementsData } = buffers

    if (buffers.positions.length >= MAX_POSITIONS) {
      return
    }
    if (quads.cells.length * COUNT_PER_QUAD >= MAX_ELEMENTS) {
      return
    }

    for (let i = 0; i < quads.positions.length; i++) {
      positionsData[i * 3] = quads.positions[i][0]
      positionsData[i * 3 + 1] = quads.positions[i][1]
      positionsData[i * 3 + 2] = quads.positions[i][2]
      normalsData[i * 3] = quads.normals[i][0]
      normalsData[i * 3 + 1] = quads.normals[i][1]
      normalsData[i * 3 + 2] = quads.normals[i][2]
    }
    if (DRAW_MODE === 'lines') {
      // lines
      for (let i = 0; i < quads.cells.length; i++) {
        const [a, b, c, d] = quads.cells[i]
        const offset = i * COUNT_PER_QUAD
        // Lines
        elementsData[offset + 0] = a
        elementsData[offset + 1] = b

        elementsData[offset + 2] = b
        elementsData[offset + 3] = c

        elementsData[offset + 4] = c
        elementsData[offset + 5] = d

        elementsData[offset + 6] = d
        elementsData[offset + 7] = a
      }
    } else {
      for (let i = 0; i < quads.cells.length; i++) {
        const offset = i * COUNT_PER_QUAD
        const [a, b, c, d] = quads.cells[i]
        // Triangle:
        elementsData[offset + 0] = a
        elementsData[offset + 1] = b
        elementsData[offset + 2] = c

        elementsData[offset + 3] = c
        elementsData[offset + 4] = d
        elementsData[offset + 5] = a
      }
    }
    buffers.positions.subdata(positionsData)
    buffers.normals.subdata(normalsData)
    buffers.elements.subdata(elementsData)

    buffers.elements({
      data: elementsData,
      count: quads.cells.length * COUNT_PER_QUAD
    })
  }
}

function lights (fn, text = '\n') {
  const array = Array.from({length: 3}).map((n, i) => i)
  return array.map(fn).join(text)
}
