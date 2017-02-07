const glsl = require('glslify')
const createMesh = require('./mask-mesh')
const quad = require('../common/quads')
const mat4 = require('gl-mat4')

module.exports = function (regl, pose) {
  const mesh = createMesh(pose)
  return createDrawMask(regl, mesh)
}

function createDrawMask (regl, mesh) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 combinedModel, headModel, model, view, projection, projView;
      uniform mat3 normalHeadModel, normalModel, normalView;
      uniform vec3 cameraPosition;
      varying vec3 vPosition, vNormal, vCameraVector;
      varying float vDepth;

      void main() {
        // Calculate global positioning
        vec4 globalPosition = combinedModel * vec4(position * 0.5, 1.0);
        gl_Position = projView * globalPosition;

        // Calculate varyings.
        vDepth = min(1.0, max(0.0, globalPosition.z + 0.5) + 0.4);
        vNormal = normalView * normalModel * normalHeadModel * normal;
        vCameraVector = normalView * (globalPosition.xyz - cameraPosition);
        vPosition = globalPosition.xyz;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform mat4 view;
      uniform mat3 normalView;
      uniform sampler2D matcapTexture;
      varying vec3 vPosition, vNormal, vCameraVector;
      varying float vDepth;

      void main() {
        vec2 uv = matcap(
          normalize(vCameraVector),
          normalize(vNormal)
        );

        vec3 color = texture2D(matcapTexture, uv).rgb;
        gl_FragColor = vec4(color * vDepth, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      matcapTexture: regl.prop('matcapTexture'),
      headModel: regl.prop('headModel'),
      model: regl.prop('model'),
      normalHeadModel: regl.prop('normalHeadModel'),
      normalModel: regl.prop('normalModel'),
      combinedModel: (() => {
        const out = []
        return (_, {model, headModel}) => mat4.multiply(out, model, headModel)
      })()
    },
    elements: quad.elementsFromQuads(regl, mesh, 'triangle'),
    primitive: 'triangle',
    cull: { enable: true }
  })
}
