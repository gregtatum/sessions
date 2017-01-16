const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createBox = require('geo-3d-box')
const simplex = new (require('simplex-noise'))()

const RADIUS = 128
const COUNT = RADIUS * RADIUS
const MODEL_SCALE = 0.023
const RESET_IN_SECONDS = 15
const ROTATE_SPEED = 0.0
const BOX_SIZE = 1.5
const BOX_RATIO = 0.2
const PASS_DIVISOR = 32

module.exports = function (regl) {
  const box = createBox({size: [BOX_SIZE * BOX_RATIO, BOX_SIZE * BOX_RATIO, BOX_SIZE]})
  box.positions.forEach(position => {
    if (position[2] > 0) {
      position[0] *= 0.5
      position[1] *= 0.5
    }
  })

  const state = Array(3).fill().map((n, pass) => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          for (let i = 0; i < COUNT; i++) {
            buffer[i * 4 + 0] = 12 * (1 + simplex.noise2D(i, 1 * 0.3, pass))
            buffer[i * 4 + 1] = 12 * (1 + simplex.noise2D(i, 2 * 0.3, pass))
            buffer[i * 4 + 2] = 22 * (1 + simplex.noise2D(i, 3 * 0.3, pass))
            buffer[i * 4 + 3] = 12 * (1 + simplex.noise2D(i, 4 * 0.3, pass))
          }
          return buffer
        })(),
        wrap: 'repeat',
        type: 'float'
      }),
      colorType: 'float',
      depthStencil: false
    })
  ))

  const updatePositions = regl({
    vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = 0.5 * (position + 1.0);
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: range = require(glsl-range)

      uniform sampler2D currState, prevState;
      uniform float time, passStep;
      varying vec2 uv;

      float TAU = 6.283185307179586;
      float PI = 3.141592653589793;
      float DAMPING = 0.001;
      float NOISE_FORCE = 100.0;
      float NOISE_SCALE = 0.05;
      float NOISE_SPEED = 0.1;
      float BASE_SPEED = 0.1;
      float STAGE_RADIUS = 10.0;
      float MAX_STAGE_RADIUS = 28.0;

      float CENTER_FORCE = 0.0;

      void main() {
        vec3 prevPositionA = texture2D(prevState, uv).rgb;
        vec3 currPositionA = texture2D(currState, uv).rgb;
        vec3 deltaPositionA = currPositionA - prevPositionA;
        vec3 directionA = normalize(deltaPositionA);
        float distanceA = length(deltaPositionA);

        // To origin forces.
        vec3 center = 10.0 * vec3(
          0.0,
          0.0,
          0.0
        );
        vec3 toCenter = 0.5 * (1.1 + sin(time)) * normalize(center - currPositionA);
        float distanceToCenter = length(currPositionA - center);
        toCenter *= range(STAGE_RADIUS, MAX_STAGE_RADIUS, min(MAX_STAGE_RADIUS, max(STAGE_RADIUS, distanceToCenter)));

        // Wandering forces.
        float wanderTheta = TAU * snoise3(vec3(5.0 * uv, time * 0.5));
        float wanderPhi = PI * 0.5 * snoise3(vec3(5.0 * uv, time * 0.5));
        vec3 wander = vec3(
          sin(wanderTheta) * cos(wanderPhi),
          sin(wanderTheta) * sin(wanderPhi),
          cos(wanderTheta)
        );

        vec3 adhesion = vec3(0.0);
        vec3 alignment = vec3(0.0);
        vec3 repulsion = vec3(0.0);

        for (float i = 0.0; i < ${COUNT}.0; i += ${PASS_DIVISOR}.0) {
          float i2 = i + passStep;
          vec2 uvB = vec2(
            mod(i2, ${RADIUS}.0) / ${RADIUS}.0,
            floor(i2 / ${RADIUS}.0) / ${RADIUS}.0
          );
          vec3 prevPositionB = texture2D(prevState, uvB).rgb;
          vec3 currPositionB = texture2D(currState, uvB).rgb;
          vec3 deltaPositionB = currPositionB - prevPositionB;
          vec3 directionB = normalize(deltaPositionB);
          float distanceB = length(deltaPositionB);

          vec3 deltaBetween = currPositionB - currPositionA;
          vec3 directionBetween = normalize(deltaBetween);
          float unitDistance = length(deltaBetween) / (MAX_STAGE_RADIUS * 2.0);

          // Do calculations here:
          alignment += directionB * pow(unitDistance, 1.5);
          adhesion += directionBetween * unitDistance;
          repulsion -= directionBetween * pow(unitDistance, 3.0);
        }

        vec3 direction = mix(directionA, normalize(
            0.5 * normalize(alignment) +
            0.8 * normalize(adhesion) +
            2.0 * normalize(repulsion) +
            5.0 * toCenter +
            0.2 * wander
        ), 0.05);

        // Sum the forces
        float speed = mix(0.3, 0.4, sin(uv.x * TAU + time));
        vec3 position = currPositionA + speed * direction;

        gl_FragColor = vec4(position, 1);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      prevState: ({tick}) => state[tick % 3],
      currState: ({tick}) => state[(tick + 1) % 3],
      passStep: ({tick}) => tick % 2,
      time: ({time}) => time,
      reset: ({time}) => {
        const i = (time / RESET_IN_SECONDS) % 1
        // Only reset in the last 10% of the time
        const i2 = Math.max(0, (10 * i - 9))
        // Quad ease in.
        return Math.pow(i2, 4)
      }
    },
    depth: { enable: false },
    count: 3,
    framebuffer: ({tick}) => state[(tick + 2) % 3]
  })

  const drawFlock = regl({
    vert: glsl`
      precision mediump float;
      #pragma glslify: rotate2d = require(glsl-y-rotate/rotateY)
      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      #pragma glslify: lookAt = require('glsl-look-at')
      #pragma glslify: inverse = require(glsl-inverse)
      #pragma glslify: transpose = require(glsl-transpose)
      uniform mat4 projection, model, view;
      uniform float viewportHeight;
      uniform sampler2D currState;
      uniform sampler2D prevState;

      varying vec3 vColor;

      float TAU = 6.283185307179586;

      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 coordinate;
      attribute float id;

      vec3 lighting (mat3 mat, float depth) {
        vec3 transformedNormal = transpose(inverse(mat)) * normal;
        float brightness = max(0.0, dot(transformedNormal, vec3(0.0, 1.0, 0.0)));
        depth = depth * 3.0 - 4.0;
        vec3 hsl = hslToRgb(
          0.5,
          0.4,
          (0.4 + 0.75 * depth) * mix(0.4, 1.0, brightness)
        );
        vec3 normalColoring = (rotate2d(TAU * 0.6) * transformedNormal) * 0.5 + 0.5;
        return mix(normalColoring, hsl, 0.5);
      }

      void main () {
        vec4 currPosition = texture2D(currState, coordinate);
        vec4 prevPosition = texture2D(prevState, coordinate);
        mat3 rotate = lookAt(prevPosition.xyz, currPosition.xyz, 0.0);
        gl_Position = projection * view * model * (vec4(rotate * position, 1.0) + currPosition);
        vColor = lighting(rotate, gl_Position.z);
      }
    `,
    frag: `
      precision mediump float;
      varying vec3 vColor;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    attributes: {
      position: box.positions,
      normal: box.normals,
      coordinate: {
        buffer: regl.buffer(Array(COUNT * 2).fill(0).map((n, i) => [
          (i % RADIUS) / RADIUS,
          Math.floor(i / RADIUS) / RADIUS
        ])),
        divisor: 2
      },
      id: {
        buffer: regl.buffer(Array(COUNT).fill(0).map((n, i) => i)),
        divisor: 1
      }
    },
    instances: COUNT,
    elements: box.cells,
    uniforms: {
      prevState: ({tick}) => state[tick % 3],
      currState: ({tick}) => state[(tick + 1) % 3],
      viewportHeight: ({viewportHeight}) => viewportHeight,
      model: (() => {
        const scale = mat4.scale([], mat4.identity([]), [MODEL_SCALE, MODEL_SCALE, MODEL_SCALE])
        const output = []
        return ({time}) => mat4.rotateY(output, scale, +time * ROTATE_SPEED - 1.5)
      })()
    }
  })

  return () => {
    updatePositions()
    drawFlock()
  }
}
