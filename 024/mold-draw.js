const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const quad = require('../common/quads')
const quat = require('gl-quat')
const { cos, sin, max, min } = Math
const lerp = require('lerp')

module.exports = function (regl, mesh) {
  const primitive = 'triangles'
  const model = mat4.identity([])
  const identity = mat4.identity([])

  return regl({
    vert: glsl`
      precision highp float;
      attribute vec3 normal, position;
      attribute float label;
      uniform float maxHeight, time;
      uniform mat4 model, view, projection;
      uniform mat3 normalModel, normalView;
      varying vec3 vNormal, vPosition, vOriginalPosition;
      varying float vLabel, vUnitHeight;

      #pragma glslify: noise2d = require(glsl-noise/simplex/2d)

      float MOVE_SPEED = 0.05;
      float MOVE_DISTANCE = 0.05;

      void main() {
        // vNormal = normalView * normalModel * normal;
        vNormal = normal;
        vUnitHeight = position.y / maxHeight;
        vOriginalPosition = position;
        vPosition = position + vec3(
          mix(0.0, MOVE_DISTANCE * noise2d(vec2(label, time * MOVE_SPEED)), vUnitHeight),
          0.0,
          mix(0.0, MOVE_DISTANCE * noise2d(vec2(time * MOVE_SPEED, label)), vUnitHeight)
        );
        float heightFactor = noise2d(vec2(label * 7.1, time * 0.02)) * 0.5 + 0.5;
        vPosition = mix(
          vPosition,
          vec3(position.x, 0.0, position.z),
          heightFactor * heightFactor * heightFactor
        );
        vLabel = label;
        gl_Position = projection * view * model * vec4(vPosition, 1.0);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: matcap = require(matcap)
      uniform vec3 cameraPosition;
      uniform sampler2D matcapTexture;
      uniform float time;
      varying vec3 vNormal, vPosition, vOriginalPosition;
      varying float vLabel, vUnitHeight;

      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)
      #pragma glslify: noise3d = require(glsl-noise/simplex/3d)
      #pragma glslify: noise4d = require(glsl-noise/simplex/4d)
      #pragma glslify: noise2d = require(glsl-noise/simplex/2d)


      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(cameraPosition, normal);
        vec3 texture = texture2D(matcapTexture, uv).rgb;

        vec3 hue = hsl2rgb(
          mod(vLabel * 1.111, 0.25) + 0.25,
          0.5,
          0.5
        );
        float heightFactor = 1.0 - (1.0 - vUnitHeight) * (1.0 - vUnitHeight);
        vec3 color = texture * hue;

        // Rim lighting
        float rimLight = (0.5 + 0.5 *
          dot(
            normal,
            vec3(0.0, 0.0, -1.0)
          )
        );
        color += 0.8 * rimLight;

        float surfaceNoise = noise4d(vec4(
          100.0 * vOriginalPosition * vec3(1.0, 0.3, 1.0),
          time * 0.2
        ));
        surfaceNoise = max(1.0, (1.0 - surfaceNoise * surfaceNoise) + 0.2);

        color *= surfaceNoise;
        color = mix(vec3(0.0, 0.2, 0.2), color, heightFactor);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals,
      label: mesh.labels,
    },
    uniforms: {
      maxHeight: mesh.maxHeight,
      model: ({viewportHeight, viewportWidth }) => {
        let ratio = viewportHeight / viewportWidth
        let scale = ratio;
        if (ratio < 0.25) {
          scale = 2;
        } else if (ratio < 0.5) {
          scale = 1.5
        } else if (ratio < 0.75) {
          scale = 1.2
        } else if (ratio < 1) {
          scale = 1.1
        } else if (ratio < 1.3) {
          scale = 1.1
        } else {
          scale = 1;
        }
        mat4.scale(model, mat4.identity(model), [scale, scale, scale])
        if (ratio > 1) {
          mat4.translate(model, model, [0, -0.03, 0]);
        }
        return model;
      },
      normalModel: () => mat3.normalFromMat4([], model),
      matcapTexture: regl.prop('assets.matcapTexture'),
    },
    elements: quad.elementsFromQuads(regl, mesh, primitive),
    primitive: primitive,
    cull: { enable: true }
  })
}
