const glsl = require('glslify')
const vec3 = require('gl-vec3')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')

module.exports = function (regl) {
  const quads = createGeometry()
  const centerPositions = quad.computeCenterPositions(quads)

  return {
    drawMask: createDrawMask(regl, quads),
    maskQuads: quads
  }
}

function createDrawMask (regl, quads) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      varying vec3 vNormal;

      void main() {
        vNormal = normal;
        gl_Position = projection * view * model * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform vec3 cameraPosition;
      uniform sampler2D matcapTexture;
      varying vec3 vNormal;

      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(cameraPosition, normal);
        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: quads.positions,
      normal: quads.normals
    },
    uniforms: {
      matcapTexture: regl.prop('matcapTexture'),
      model: regl.context('headModel')
    },
    elements: quad.elementsFromQuads(regl, quads, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createGeometry () {
  // Create a box.
  const w = 0.5
  const h = 0.3
  const d = 0.1
  let quads = quad.createBox(w, h, d)

  // Split the box in half.
  const centerRing = quad.getNewGeometry(quads, 'positions', () => {
    quad.splitLoop(quads, quads.cells[3], 0.6)
    quad.splitLoop(quads, quads.cells[3], 0.75)
  })
  createEyeHoles(quads, w, h, d)
  // Adjust nose shape.
  centerRing.forEach(p => {
    p[2] += 0.1
    if (p[1] < 0) {
      p[2] += 0.1
    }
  })
  shapeEyes(quads)
  shapeMaskBack(quads)
  refineEyes(quads)
  shapeNose(quads)
  extrudeHair(quads)
  quad.subdivide(quads, 2)
  return quads
}

function shapeEyes (quads) {
  ;[27, 19, 20, 28].forEach(i => {
    quads.positions[i][0] *= 0.5
    quads.positions[i][1] -= 0.1
  })
}

function shapeMaskBack (quads) {
  ;[0, 3].forEach(i => {
    quads.positions[i][0] *= 1.2
    quads.positions[i][1] -= 0.1
    quads.positions[i][2] -= 0.1
  })
}

function createEyeHoles (quads, w, h, d) {
  // Create some eye-holes.
  const leftEyeFrontIndex = 3
  const leftEyeBackIndex = 5
  const rightEyeFrontIndex = 6
  const rightEyeBackIndex = 8
  const leftEyeFront = quads.cells[leftEyeFrontIndex]
  const leftEyeBack = quads.cells[leftEyeBackIndex]
  const rightEyeFront = quads.cells[rightEyeFrontIndex]
  const rightEyeBack = quads.cells[rightEyeBackIndex]

  quad.inset(quads, leftEyeFront, 0.5)
  quad.inset(quads, leftEyeBack, 0.5)
  quad.inset(quads, rightEyeFront, 0.5)
  quad.inset(quads, rightEyeBack, 0.5)

  quad.extrude(quads, leftEyeFront, 0, 0)
  quad.extrude(quads, rightEyeFront, 0, 0)

  leftEyeFront.forEach(i => quads.positions[i][2] = -d / 2)
  rightEyeFront.forEach(i => quads.positions[i][2] = -d / 2)
  quads.cells.splice(8, 1)
  quads.cells.splice(6, 1)
  quads.cells.splice(5, 1)
  quads.cells.splice(3, 1)
  quad.mergePositions(quads)
}

function refineEyes (quads, cellIndex) {
  quad.subdivide(quads, 1)
  ;[[48, true], [75, false]].forEach(([cellIndex, opposite]) => {
    const cell = quads.cells[cellIndex]
    quad.insetLoop(quads, cell, 0.05, opposite)

    const ring = quad.getNewGeometry(quads, 'positions', () => {
      quad.insetLoop(quads, cell, 0.00, opposite)
      quad.insetLoop(quads, cell, 0.05, opposite)
    })

    quad.getLoop(quads, quads.cells[146], 'cells')
      .reduce((a, b) => a.concat(b))
      .map(i => quads.positions[i])
      .concat(ring)
      .filter(unique)
      .forEach(p => p[2] += 0.01)
  })
}

function shapeNose (quads) {
  ;[42, 43, 46].forEach(i => {
    quads.positions[i][2] -= 0.05
  })

  quad.splitLoop(quads, quads.cells[25], 0.2, true)

  ;[230, 231, 232].forEach(i => {
    quads.positions[i][0] *= 2
    quads.positions[i][1] += 0.05
    quads.positions[i][2] += 0.05
  })
}

function extrudeHair (quads) {
  // Adjust top rim sizing of the mask
  // Top row back
  quads.positions[53][2] -= 0.028
  quads.positions[51][2] -= 0.028
  quads.positions[7][2] -= 0.015
  quads.positions[37][2] -= 0.015

  quads.positions[7][1] += 0.015
  quads.positions[37][1] += 0.015

  // Bottom Row back
  quads.positions[36][2] -= 0.03
  quads.positions[51][2] -= 0.03
  quads.positions[8][2] -= 0.03
  quad.computeNormals(quads)

  quad.splitLoop(quads, quads.cells[10], 0.5, true)
  quad.splitLoop(quads, quads.cells[9], 0.5)
  quad.splitLoop(quads, quads.cells[13], 0.5)
  quad.splitLoop(quads, quads.cells[14], 0.5, true)

  // return
  // const cells = [0, 3, 36, 39, 20, 23].map(i => quads.cells[i])
  const random = createRandom(11)
  const cells = quad
    .getLoop(quads, quads.cells[0], 'cells', true)
    .filter(unique)
    .filter(cell => (
      quads.positions[cell[0]][1] +
      quads.positions[cell[1]][1] +
      quads.positions[cell[2]][1] +
      quads.positions[cell[3]][1] > -0.4
    ))

  cells.forEach(cell => extrudeAndRotateCell(quads, cell, random))
  cells.forEach(cell => quad.extrude(quads, cell, 0.1, 0.005))
  cells.forEach(cell => extrudeAndRotateCell(quads, cell, random))
  cells.forEach(cell => quad.extrude(quads, cell, 0.25, 0.025))
  cells.forEach(cell => extrudeAndRotateCell(quads, cell, random))
  cells.forEach(cell => quad.extrude(quads, cell, 0.25, 0.025))
  cells.forEach(cell => extrudeAndRotateCell(quads, cell, random))
}

function extrudeAndRotateCell (quads, cell, random) {
  quad.extrude(quads, cell, 0.5, 0.025)
  const range = 0.4
  const rotateA = random() * range - range / 2
  const rotateB = random() * range - range / 2

  cell.forEach(i => {
    const position = quads.positions[i]
    vec3.rotateZ(position, position, [0, 0, 0], rotateA)
    vec3.rotateY(position, position, [0, 0, 0], rotateB)
    position[2] -= 0.1
  })
}

function unique (value, index, self) {
  return self.indexOf(value) === index
}
