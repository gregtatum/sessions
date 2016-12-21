const glsl = require('glslify')
const mat4 = require('gl-mat4')

const TAU = 6.283185307179586
const RADIUS = 256
const COUNT = RADIUS * RADIUS
const POSITION_SCALE = 100
const MODEL_SCALE = 0.5 / POSITION_SCALE
const RESET_IN_SECONDS = 15
const ROTATE_SPEED = 0.1

module.exports = function (regl) {
  const state = Array(3).fill().map(() => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          for (let i = 0; i < COUNT; i++) {
            const theta = TAU * i / COUNT
            buffer[i * 4 + 0] = POSITION_SCALE * 0.25 * Math.cos(4 * theta)
            buffer[i * 4 + 1] = POSITION_SCALE * 0.25 * Math.sin(4 * theta)
            buffer[i * 4 + 2] = POSITION_SCALE * 0.25 * i / COUNT
            buffer[i * 4 + 3] = POSITION_SCALE * 5
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
    frag: `
      precision mediump float;
      uniform sampler2D prevState;
      uniform sampler2D currState;
      uniform float force;
      uniform float effect;
      varying vec2 uv;

      float TAU = 6.283185307179586;

      float distanceSq(vec3 v) {
        return v.x * v.x + v.y * v.y + v.z * v.z;
      }

      void main() {
        vec3 prevPosition = texture2D(prevState, uv).rgb;
        vec3 currPosition = texture2D(currState, uv).rgb;
        vec3 deltaPosition = currPosition - prevPosition;
        vec3 gravity = -1.0 * vec3(normalize(currPosition)) / max(20.0, distanceSq(currPosition));
        vec3 position = currPosition + deltaPosition + gravity;

        float i = (uv[0] / ${RADIUS.toFixed(1)} + uv[1]);
        position = mix(position, vec3(
          80.0 * (i - 0.5),
          25.0 * sin(5.0 * i * TAU),
          mix(100.0 * sin(i * TAU) - 5.0, 20.0, effect)
        ), force);

        gl_FragColor = vec4(position, 1);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      prevState: ({tick}) => state[tick % 3],
      currState: ({tick}) => state[(tick + 1) % 3],
      force: ({time}) => {
        const i = (time / RESET_IN_SECONDS) % 1
        // Only reset in the last 10% of the time
        const i2 = Math.max(0, (10 * i - 9))
        // Quad ease in.
        return Math.pow(i2, 4)
      },
      effect: ({time}) => Math.floor(time / RESET_IN_SECONDS) % 2
    },
    depth: { enable: false },
    count: 3,
    framebuffer: ({tick}) => state[(tick + 2) % 3]
  })

  const drawWave = regl({
    vert: glsl`
      precision mediump float;
      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      uniform mat4 projection, model, view;
      uniform float viewportHeight;
      attribute vec2 coordinate;
      attribute float id;
      varying vec3 vColor;
      uniform sampler2D currState;
      uniform sampler2D prevState;

      float POINT_SIZE = 0.07;

      void main () {
        vec4 currPosition = texture2D(currState, coordinate);
        vec4 prevPosition = texture2D(prevState, coordinate);
        float speed = min(0.2, length(currPosition - prevPosition));
        vColor = hslToRgb(
          id / ${COUNT.toFixed(1)},
          0.5 + 0.25 * speed,
          0.4 + 0.75 * speed
        );
        gl_Position = projection * view * model * currPosition;
        gl_PointSize = max(0.00005 * viewportHeight, speed) * POINT_SIZE * viewportHeight;
      }
    `,
    frag: `
      precision mediump float;
      varying vec3 vColor;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    primitive: 'points',
    attributes: {
      coordinate: Array(COUNT).fill(0).map((n, i) => [
        (i % RADIUS) / RADIUS,
        Math.floor(i / RADIUS) / RADIUS
      ]),
      id: Array(COUNT).fill(0).map((n, i) => i)
    },
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
    count: COUNT
  })

  return () => {
    updatePositions()
    drawWave()
  }
}
