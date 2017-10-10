const glsl = require('glslify')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')
const mat3 = require('gl-mat3')
const quad = require('../common/quads')
const quat = require('gl-quat')

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
      varying vec3 vNormal;

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
        rotatedPosition = position;

        gl_Position = projection * view * model * vec4(rotatedPosition, 1.0);
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
      position: mesh.positions,
      normal: mesh.normals
    },
    uniforms: {
      model: (() => {
        const range = 0.25
        const target = [0, 1, 0]
        const quaternion = quat.identity([])
        const direction = [0, 0, 1]
        const position = [0, 0, 0]
        const UP = [0, 1, 0]
        const ORIGIN = [0, 0, 0]

        return ({time}) => {
          target[0] = Math.sin(time) * range
          target[1] = Math.cos(time) * range

          // Compute the new direction
          const directionToTarget = vec3.subtract([], target, position);
          const distanceToTarget = vec3.length(directionToTarget)
          vec3.scale(directionToTarget, directionToTarget, 1 / distanceToTarget)
          position[0] += directionToTarget[0] * 0.02 * distanceToTarget
          position[1] += directionToTarget[1] * 0.02 * distanceToTarget
          position[2] += directionToTarget[2] * 0.02 * distanceToTarget
          console.log(directionToTarget)
          position[0] = 0
          position[1] = 0
          position[2] = 0

          return mat4.multiply(model,
            mat4.translate([], mat4.identity([]), position),
            mat4.multiply([],
              mat4.lookAt([], ORIGIN, [0, 1, 0.001], UP),
              mat4.identity([])
            )
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
