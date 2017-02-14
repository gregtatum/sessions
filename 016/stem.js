const lerp = require('lerp')
const quad = require('../common/quads')
const glsl = require('glslify')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const vec3 = require('gl-vec3')
const createRandom = require('@tatumcreative/random')
const TAU = 6.283185307179586
const origin = [0, 0, 0]
const RECEPTECAL_SIZE = 0.2
const RECEPTECAL_HEIGHT = 0.25
const BASE_OFFSET = -0.16

module.exports = function rayFlorets (regl) {
  const mesh = createMesh()
  const drawStem = createDrawStem(regl, mesh)
  return drawStem
}

function createMesh () {
  const mesh = quad.createBox(
    RECEPTECAL_SIZE,
    RECEPTECAL_SIZE * RECEPTECAL_HEIGHT,
    RECEPTECAL_SIZE
  )

  // Extrude down.
  quad.extrude(mesh, mesh.cells[1], 0.8, 0.025)
  quad.extrude(mesh, mesh.cells[1], 0.0, 0.1)
  quad.extrude(mesh, mesh.cells[1], 0.0, 0.3)

  // Extrude top inset.
  quad.extrude(mesh, mesh.cells[0], 0.5, -0.005)

  mesh.positions.forEach(p => {
    p[1] += BASE_OFFSET
  })

  return quad.subdivide(mesh, 2)
}

function createDrawStem (regl, mesh) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection, projView;
      uniform mat3 normalModel, normalView;
      uniform vec3 cameraPosition;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vNormal = normalView * normalModel * normal;
        vCameraVector = normalView * (position.xyz - cameraPosition);

        gl_Position = projView * vec4(position, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform sampler2D matcapTexture;
      varying vec3 vNormal, vCameraVector;

      void main() {
        vec2 uv = matcap(
          normalize(vCameraVector),
          normalize(vNormal)
        );

        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color.ggg, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
    },
    uniforms: {
      model: mat4.identity([]),
      normalModel: mat3.identity([]),
      matcapTexture: regl.prop('matcapTexture')
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    cull: { enable: true }
  })
}
