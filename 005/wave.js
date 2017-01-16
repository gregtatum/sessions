const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createBox = require('geo-3d-box')

const TAU = 6.283185307179586
const RADIUS = 128
const COUNT = RADIUS * RADIUS
const POSITION_SCALE = 15
const MODEL_SCALE = 0.7 / POSITION_SCALE
const RESET_IN_SECONDS = 15
const ROTATE_SPEED = 0.1
const BOX_SIZE = 1
const BOX_RATIO = 0.2

module.exports = function (regl) {
  const box = createBox({size: [BOX_SIZE * BOX_RATIO, BOX_SIZE * BOX_RATIO, BOX_SIZE]})

  const state = Array(3).fill().map(() => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          for (let i = 0; i < COUNT; i++) {
            const theta = TAU * i / COUNT
            buffer[i * 4 + 0] = POSITION_SCALE * Math.cos(4 * theta)
            buffer[i * 4 + 1] = POSITION_SCALE * i / COUNT
            buffer[i * 4 + 2] = POSITION_SCALE * Math.sin(4 * theta)
            buffer[i * 4 + 3] = POSITION_SCALE * 1.25
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
      float ORIGIN_FORCE = 0.2;
      float RESET_FORCE = 0.2;
      float BASE_SPEED = 0.5;

      void main() {
        vec3 prevPosition = texture2D(prevState, uv).rgb;
        vec3 currPosition = texture2D(currState, uv).rgb;
        vec3 deltaPosition = currPosition - prevPosition;
        vec3 direction = normalize(deltaPosition);
        float dist = length(deltaPosition);
        vec3 toOrigin = normalize(currPosition * -1.0);
        vec3 noiseForce = 0.01 * vec3(
          snoise4(vec4(currPosition * NOISE_SCALE, NOISE_SPEED * time + 0.0)),
          snoise4(vec4(currPosition * NOISE_SCALE, NOISE_SPEED * time + 10.0)),
          snoise4(vec4(currPosition * NOISE_SCALE, NOISE_SPEED * time + 20.0))
        );
        float theta = (uv[0] / ${RADIUS.toFixed(1)} + uv[1]) * ${TAU};
        vec3 resetPosition = vec3(cos(theta), 0.0, sin(theta)) * ${(0.5 * POSITION_SCALE).toFixed(1)};
        vec3 toReset = normalize(resetPosition - currPosition);
        vec3 position = currPosition + mix(BASE_SPEED, dist, 0.95) * normalize(
          direction
          + noiseForce * NOISE_FORCE
          + toReset * RESET_FORCE);

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

  const drawWave = regl({
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
          0.5 * id * ${1 / COUNT},
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
    }
  })

  return () => {
    updatePositions()
    drawWave()
  }
}
