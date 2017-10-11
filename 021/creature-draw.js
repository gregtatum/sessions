const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const quad = require('../common/quads')
const quat = require('gl-quat')
const { cos, sin, max, min } = Math

module.exports = function (regl, mesh) {
  const primitive = 'triangles'
  const model = []

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 normal, position;
      uniform mat4 model, view, projection;
      uniform mat3 normalModel, normalView;
      uniform float time, tentacleStartingHeight, size;
      varying vec3 vNormal, vPosition;

      vec3 rotateY(vec3 vector, float theta) {
        return vec3(
          vector.z * sin(theta) + vector.x * cos(theta),
          vector.y,
          vector.z * cos(theta) - vector.x * sin(theta)
        );
      }

      float waveSpeed = 1.5;
      float rotationSpeed = -0.2;

      void main() {
        float waveAmount = max(0.0, min(1.0, (tentacleStartingHeight - position.y) / size));
        vec3 wavePosition = vec3(
          position.x + sin(position.y * 20.0 + time * waveSpeed) * 0.05 * waveAmount,
          position.y + 0.1,
          position.z + cos(position.y * 20.0 + time * waveSpeed) * 0.05 * waveAmount
        );

        float rotation = time * rotationSpeed;
        vec3 rotatedPosition = rotateY(wavePosition, rotation);
        vNormal = normalView * normalModel * rotateY(normal, rotation);

        rotatedPosition.x += sin(time + position.y * 20.0) * 0.005;
        vPosition = rotatedPosition;
        gl_Position = projection * view * model * vec4(rotatedPosition, 1.0);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: matcap = require(matcap)
      uniform vec3 cameraPosition;
      uniform sampler2D matcapTexture;
      uniform float time;
      varying vec3 vNormal, vPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec2 uv = matcap(cameraPosition, normal);
        vec3 color = texture2D(matcapTexture, uv).rgb;
        vec3 ambient = vec3(0.35, 0.55, 0.8) * 0.5;
        float ambientMix = mix(0.75, 0.9,
          sin(time * 2.0 + vPosition.y * 6.0)
        );
        float brightness = 0.15 * (
          sin(time * 2.0 + vPosition.x * 50.0) * 0.5 + 0.5 +
          cos(time * 2.0 + vPosition.y * 50.0) * 0.5 + 0.5
        );
        vec3 red = vec3(1.0, 0.0, 0.5);
        gl_FragColor = vec4(
          mix(
            mix(ambient, color, ambientMix)
              + brightness * vec3(1.0, 0.8, 1.0),
            red,
            max(0.0, min(1.0, -vPosition.y * 2.0 + 0.2)) * (sin(time * 3.0) * 0.2 + 0.8)
          ),
          1.0
        );
      }
    `,
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      model: (() => {
        const ROTATION_SPEED = 0.1;
        const ROTATION_BASE = 1.0;
        return ({time, viewportHeight, viewportWidth}) => {
          const rotation = Math.sin(time) * ROTATION_SPEED - ROTATION_BASE
          const translationTheta = time * 0.5
          const translationAmt = 0.05
          const scale = max(0.5, min(1.4, viewportWidth / viewportHeight * 1.2 - 0.4))

          return mat4.translate(
            mat4.scale(model, model, 2.0),
            mat4.rotateZ(model,
              mat4.scale(model, mat4.identity(model), [scale, scale, scale]),
              rotation
            ),
            [
              translationAmt * cos(translationTheta),
              translationAmt * sin(translationTheta),
              0
            ]
          )
        }
      })(),
      normalModel: () => {
        return mat3.identity([])
        mat3.normalFromMat4([], model)
      },
      matcapTexture: regl.prop('matcapTexture'),
      tentacleStartingHeight: mesh.tentacleStartingHeight,
      size: mesh.size,
    },
    elements: quad.elementsFromQuads(regl, mesh, primitive),
    primitive: primitive,
    cull: { enable: true }
  })
}
