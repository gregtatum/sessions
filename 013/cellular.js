const glsl = require('glslify')
const vec3 = require('gl-vec3')
const quad = require('../common/quads')
const subdivideQuads = require('gl-catmull-clark')

module.exports = function (regl) {
  const quads = createGeometry()
  const primitive = 'triangles'

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      varying vec3 vNormal;

      void main() {
        vNormal = normal;
        gl_Position = projection * view * vec4(position, 1.0);
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
      matcapTexture: regl.prop('matcapTexture')
    },
    elements: quad.elementsFromQuads(regl, quads, primitive),
    primitive: primitive,
    cull: { enable: true }
  })
}

function createGeometry () {
  // Create a box.
  let quads = quad.createBox(0.1, 0.1, 0.1)

  // Subdivide it.
  quads = subdivideQuads(quads.positions, quads.cells, 2, false)
  quad.computeNormals(quads)

  // Make some insets.
  const cells = quads.cells.slice()
  // Inset inside.
  cells.forEach(cell => rotater(quads, cell))
  cells.forEach(cell => quad.extrude(quads, cell, 0.8, 0.01))
  cells.forEach(cell => rotater(quads, cell))
  cells.forEach(cell => quad.extrude(quads, cell, 0.25, 0.025))
  cells.forEach(cell => rotater(quads, cell))
  cells.forEach(cell => quad.extrude(quads, cell, 0.25, 0.025))
  cells.forEach(cell => rotater(quads, cell))

  // Subdivide again
  quads = subdivideQuads(quads.positions, quads.cells, 2, false)
  quad.computeNormals(quads)

  return quads
}

function rotater (quads, cell) {
  quad.extrude(quads, cell, 0.5, 0.05)
  const rotate = Math.random() * 0.5
  cell.forEach(i => {
    const position = quads.positions[i]
    vec3.rotateY(position, position, [0, 0, 0], rotate)
  })
}
