const glsl = require('glslify')
const vec3 = require('gl-vec3')
const quad = require('../common/quads')
const simplex = new (require('simplex-noise'))()

module.exports = function (regl) {
  const quads = createGeometry()
  const {elements, drawMode} = elementsFromQuads(regl, quads, 'triangles')

  return regl({
    vert: glsl`
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      #pragma glslify: rotateY = require(../common/glsl/rotateY)

      precision mediump float;
      attribute vec3 normal, position;
      attribute float branch, depth;
      uniform mat4 inverseView, view, projection;
      uniform float time;
      varying vec3 vColor;

      void main() {
        vec3 position2 = position + depth * 0.03 * vec3(
          snoise4(vec4(position * 4.0, branch + time + 0.0)) + 0.5 * snoise4(vec4(position * 50.0, branch + time + 0.0)),
          snoise4(vec4(position * 4.0, branch + time + 7.0)) + 0.5 * snoise4(vec4(position * 50.0, branch + time + 7.0)),
          snoise4(vec4(position * 4.0, branch + time - 7.0)) + 0.5 * snoise4(vec4(position * 50.0, branch + time - 7.0))
        );
        position2 = rotateY(position2, 0.5 * sin(time * 0.5 + position.y * 5.0));
        float lambertian = max(0.0, dot(normal, vec3(0.0, 1.0, 0.0)));
        gl_Position = projection * view * vec4(position2, 1.0);

        vec3 baseColor = hsl2rgb(-depth + 0.7, mix(0.3, 0.7, depth), 0.5);
        vColor = baseColor *
          max(0.2,
            mix(0.6, 1.0, lambertian) +
            mix(-0.5, 10.0, 0.5 - 0.5 * gl_Position.z)
          );
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    attributes: {
      position: quads.positions,
      normal: quads.normals,
      branch: quads.branch,
      depth: quads.depth
    },
    elements: elements,
    primitive: drawMode,
    cull: { enable: true }
  })
}

function createGeometry () {
  const WIDTH = 0.02
  const HEIGHT = 0.5
  const DEPTH = 20
  const TAPER = 0.2
  const BRANCHES = 100

  const w = WIDTH / 2
  const h = -HEIGHT / 2 - 0.1
  const quads = {
    positions: [
      [-w, h, -w],
      [-w, h, w],
      [w, h, w],
      [w, h, -w]
    ],
    normals: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0]
    ],
    branch: null,
    depth: null,
    cells: [[0, 1, 2, 3], [7, 6, 5, 4]]
  }

  const bottomCell = quad.clone(quads, quads.cells[0])
  quad.flip(quads, bottomCell)
  quad.extrude(quads, bottomCell, -3, 0.5)

  quads.branch = quads.positions.map(() => 0)
  quads.depth = quads.branch.slice()

  for (let j = 0; j < BRANCHES; j++) {
    const branchLength = quads.positions.length
    let depthLength = quads.positions.length
    const tipCell = quad.clone(quads, quads.cells[0])
    const tipNormal = quads.normals[tipCell[0]]
    const rotate = createRotater(quads)
    let height = 0.03

    // Extrude the tip out by a certain depth.
    for (let i = 0; i < DEPTH; i++) {
      height *= 0.9
      quad.extrude(quads, tipCell, TAPER, height)
      rotate(tipCell, tipNormal, height, i / DEPTH, j / BRANCHES)

      for (let k = depthLength; k < quads.positions.length; k++) {
        quads.depth[k] = i / DEPTH
      }
      depthLength = quads.positions.length
    }

    for (let i = branchLength; i < quads.positions.length; i++) {
      quads.branch[i] = j / BRANCHES
    }
  }

  return quads
}

function createRotater (quads) {
  const center = []
  const rotateCenter = []

  return (cell, normal, height, depth, branch) => {
    quad.getCenter(quads, cell, center)
    vec3.add(rotateCenter, center, vec3.scale(rotateCenter, normal, -height))
    const zTheta = 0.5 * (0.4 + depth) * simplex.noise2D(depth * 3, branch * 500)
    const xTheta = 0.5 * (0.4 + depth) * simplex.noise2D(100 + depth * 3, branch * 500)

    for (let i = 0; i < 4; i++) {
      const position = quads.positions[cell[i]]
      vec3.rotateZ(position, position, rotateCenter, zTheta)
      vec3.rotateX(position, position, rotateCenter, xTheta)
    }
  }
}

function elementsFromQuads (regl, quads, drawMode = 'triangles') {
  const countPerCell = drawMode === 'lines' ? 8 : 6
  const elementsData = new Uint16Array(quads.cells.length * countPerCell)

  if (drawMode === 'lines') {
    // lines
    for (let i = 0; i < quads.cells.length; i++) {
      const [a, b, c, d] = quads.cells[i]
      const offset = i * countPerCell
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
      const offset = i * countPerCell
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
  return {
    elements: regl.elements({
      data: elementsData,
      count: elementsData.length
    }),
    drawMode
  }
}
