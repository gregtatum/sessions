const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createBox = require('geo-3d-box')
const simplex = new (require('simplex-noise'))()

const TAU = 6.283185307179586
const RADIUS = 64
const COUNT = RADIUS * RADIUS
const POSITION_SCALE = 40
const MODEL_SCALE = 0.02
const RESET_IN_SECONDS = 15
const ROTATE_SPEED = 0.0
const BOX_SIZE = 1
const BOX_RATIO = 0.2

module.exports = function (regl) {
  const box = createBox({size: [BOX_SIZE * BOX_RATIO, BOX_SIZE * BOX_RATIO, BOX_SIZE]})

  const state = Array(3).fill().map((n, pass) => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          for (let i = 0; i < COUNT; i++) {
            const theta = TAU * i / COUNT
            buffer[i * 4 + 0] = 12 * simplex.noise2D(i, 1 * 0.3, pass)
            buffer[i * 4 + 1] = 12 * simplex.noise2D(i, 2 * 0.3, pass)
            buffer[i * 4 + 2] = 22 * simplex.noise2D(i, 3 * 0.3, pass)
            buffer[i * 4 + 3] = 12 * simplex.noise2D(i, 4 * 0.3, pass)
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
      #pragma glslify: snoise4 = require(glsl-noise/simplex/4d)

      uniform sampler2D prevState;
      uniform sampler2D currState;
      uniform float time;
      varying vec2 uv;

      float TAU = 6.283185307179586;
      float DAMPING = 0.001;
      float NOISE_FORCE = 100.0;
      float NOISE_SCALE = 0.05;
      float NOISE_SPEED = 0.1;
      float BASE_SPEED = 0.1;

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
          cos(time * 1.0),
          sin(time * 1.0)
        );
        vec3 toCenter = normalize(center - currPositionA);

        // The fourth parameter is the speed.
        vec3 adhesion = vec3(0.0);
        vec3 alignment = vec3(0.0);
        vec3 repulsion = vec3(0.0);

        for (float i = 0.0; i < ${COUNT}.0; i++) {
          vec2 uvB = vec2(
            mod(i, ${RADIUS}.0) / ${RADIUS}.0,
            floor(i / ${RADIUS}.0) / ${RADIUS}.0
          );
          vec3 prevPositionB = texture2D(prevState, uvB).rgb;
          vec3 currPositionB = texture2D(currState, uvB).rgb;
          vec3 deltaPositionB = currPositionB - prevPositionB;
          vec3 directionB = normalize(deltaPositionB);
          float distanceB = length(deltaPositionB);

          vec3 deltaBetween = currPositionB - currPositionA;
          vec3 directionBetween = normalize(deltaBetween);
          float inverseDistance = 1.0 / length(deltaBetween);

          // Do calculations here:
          alignment += directionB * pow(inverseDistance, 2.0);
          adhesion += directionBetween * pow(inverseDistance, 2.0);
          repulsion -= directionBetween * pow(inverseDistance, 4.0);
        }

        vec3 direction = mix(directionA, normalize(
            5.0 * normalize(alignment) +
            0.5 * normalize(adhesion) +
            0.5 * normalize(repulsion) +
            0.2 * (1.1 + sin(time)) * toCenter
        ), 0.05);

        // Sum the forces
        vec3 position = currPositionA + 0.2 * direction;

        gl_FragColor = vec4(position, 1);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      prevState: ({tick}) => state[tick % 3],
      currState: ({tick}) => state[(tick + 1) % 3],
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
      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      #pragma glslify: lookAt = require('glsl-look-at')
      uniform mat4 projection, model, view;
      uniform float viewportHeight;
      uniform sampler2D currState;
      uniform sampler2D prevState;

      varying vec3 vColor;

      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 coordinate;
      attribute float id;

      vec3 lighting (float speed) {
        float brightness = max(0.0, dot(normal, vec3(0.608229, 0.760286, 0.228086)));
        return hslToRgb(
          0.5,
          0.4 + 0.25 * speed,
          (0.4 + 0.75 * speed) * mix(0.7, 1.0, brightness)
        );
      }

      void main () {
        vec4 currPosition = texture2D(currState, coordinate);
        vec4 prevPosition = texture2D(prevState, coordinate);
        float speed = min(0.2, length(currPosition - prevPosition));
        mat3 rotate = lookAt(prevPosition.xyz, currPosition.xyz, 0.0);
        vColor = lighting(speed);
        gl_Position = projection * view * model * (vec4(rotate * position, 1.0) + currPosition);
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
    },
  })

  return () => {
    updatePositions()
    drawFlock()
  }
}
