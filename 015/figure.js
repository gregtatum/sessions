const glsl = require('glslify')
const vec3 = require('gl-vec3')
const quad = require('../common/quads')
const createRandom = require('@tatumcreative/random')

module.exports = function (regl) {
  const mesh = createGeometry()
  return {
    figureMesh: mesh,
    drawFigure: createDrawMaskBody(regl, mesh)
  }
}

function createDrawMaskBody (regl, mesh) {
  const arr1 = []
  const arr2 = []
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, headModel, view, projection;
      uniform mat3 normalView, normalModel, normalHeadModel;
      uniform vec3 cameraPosition;
      varying vec3 vNormal, vPosition;
      varying float vDepth;

      void main() {
        vec4 morphed = vec4(position, 1.0);
        float modelMix = min(1.0, max(0.0, position.y + 1.0));
        morphed = mix(
          morphed,
          headModel * morphed,
          modelMix
        );
        vNormal = normalView * normalModel * normalize(mix(
          normal,
          normalHeadModel * normal,
          modelMix
        ));
        vPosition = position;
        gl_Position = projection * view * model * morphed;
        vDepth = max(0.0, morphed.z + 0.5) + 0.2;
      }
    `,
    frag: glsl`
      precision mediump float;
      varying vec3 vNormal, vPosition;
      varying float vDepth;

      void main() {
        float brightness = max(0.0, 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)));
        brightness = 0.5 * brightness * brightness;

        vec3 color = vec3(0.5, 0.4, 0.0) *
          max(
            0.0,
            1.0 * distance(vPosition, vec3(0.0, 0.0, 0.0)) - 0.2
          );

        gl_FragColor = vec4(
          (vec3(brightness) + color) * vDepth,
          1.0
        );
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      headModel: regl.prop('headModel'),
      model: regl.prop('model'),
      normalHeadModel: regl.prop('normalHeadModel'),
      normalModel: regl.prop('normalModel'),
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}

function createGeometry () {
  // Create a box.
  const w = 0.10
  const h = 0.7
  const d = 0.13
  let mesh = quad.createBox(w, h, d)
  mesh.cells.splice(1, 1)
  mesh.positions.forEach(p => {
    p[1] -= 0.3
    p[2] -= 0.04
  })
  ;[0, 1, 2, 3].forEach(i => {
    const position = mesh.positions[i]
    position[0] *= 3.75
    position[1] *= 1.5
    position[2] *= 1.5
    position[2] -= 0.3
  })
  quad.splitLoop(mesh, mesh.cells[2], 0.9, true)
  quad.subdivide(mesh, 3)
  return mesh
}
