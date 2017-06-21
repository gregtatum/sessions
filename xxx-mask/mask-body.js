const glsl = require('glslify')
const vec3 = require('gl-vec3')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')

module.exports = function (regl) {
  const quads = createGeometry()
  return {
    maskBodyQuads: quads,
    drawMaskBody: createDrawMaskBody(regl, quads)
  }
}

function createDrawMaskBody (regl, quads) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      uniform mat3 normalView;
      uniform vec3 cameraPosition;
      varying vec3 vNormal, vPosition;

      void main() {
        vec4 morphed = mix(
          vec4(position, 1.0),
          model * vec4(position, 1.0),
          min(1.0, max(0.0, position.y + 1.0))
        );
        vNormal = normalView * normal;
        vPosition = position;
        gl_Position = projection * view * morphed;
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vNormal, vPosition;

      void main() {
        float brightness = max(0.0, 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)));
        brightness = 0.5 * brightness * brightness;

        vec3 green = vec3(0.0, 0.5, 0.0) *
          max(
            0.0,
            1.0 * distance(vPosition, vec3(0.0, 0.0, 0.0)) - 0.2
          );

        gl_FragColor = vec4(
          vec3(brightness) + green,
          1.0
        );
      }
    `,
    attributes: {
      position: quads.positions,
      normal: quads.normals
    },
    uniforms: {
      model: regl.context('headModel')
    },
    elements: quad.elementsFromQuads(regl, quads, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createGeometry () {
  // Create a box.
  const w = 0.46
  const h = 1
  const d = 0.5
  let quads = quad.createBox(w, h, d)
  quads.cells.splice(1, 1)
  quads.positions.forEach(p => {
    p[1] -= 0.4
    p[2] -= 0.13
  })
  ;[0, 1, 2, 3].forEach(i => {
    const position = quads.positions[i]
    position[0] *= 3.75
    position[1] *= 1.5
    position[2] *= 1.5
    position[2] -= 0.5
  })
  quad.splitLoop(quads, quads.cells[2], 0.9, true)
  quad.subdivide(quads, 3)
  return quads
}
