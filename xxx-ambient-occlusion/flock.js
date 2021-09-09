const glsl = require('glslify')
const mat4 = require('gl-mat4')
const createBox = require('geo-3d-box')
const simplex = new (require('simplex-noise'))()

const RADIUS = 64
const COUNT = RADIUS * RADIUS
const MODEL_SCALE = 0.023
const ROTATE_SPEED = 0.0
const BOX_SIZE = 3.5
const BOX_RATIO = 0.2
const BOX_TAPER = 0.25;

module.exports = function (regl) {
  const box = createBox({size: [
    BOX_SIZE * BOX_RATIO,
    BOX_SIZE * BOX_RATIO,
    BOX_SIZE
  ]})
  box.positions.forEach(position => {
    if (position[2] > 0) {
      position[0] *= BOX_TAPER
      position[1] *= BOX_TAPER
    }
  })

  const state = Array(3).fill().map((n, pass) => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          for (let i = 0; i < COUNT; i++) {
            buffer[i * 4 + 0] = 0.25 * 12 * (1 + simplex.noise2D(i, 1 * 0.3, pass))
            buffer[i * 4 + 1] = 0.25 * 12 * (1 + simplex.noise2D(i, 2 * 0.3, pass))
            buffer[i * 4 + 2] = 0.25 * 22 * (1 + simplex.noise2D(i, 3 * 0.3, pass))
            buffer[i * 4 + 3] = 0.25 * 12 * (1 + simplex.noise2D(i, 4 * 0.3, pass))
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

  const updateFlock = regl({
    vert: glsl`
      precision highp float;
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = 0.5 * (position + 1.0);
        gl_Position = vec4(position, 0, 1);
      }
    `,
    frag: glsl`
      precision highp float;
      #pragma glslify: noise3d = require(glsl-noise/simplex/3d)
      #pragma glslify: noise4d = require(glsl-noise/simplex/4d)
      #pragma glslify: range = require(glsl-range)

      uniform sampler2D currState, prevState;
      uniform float tick, passStep;
      varying vec2 uv;

      float TAU = 6.283185307179586;
      float PI = 3.141592653589793;
      float NOISE_DENSITY = 0.02;
      float NOISE_SPEED = 0.1;
      float TURN_SPEED = 0.03;

      float NOISE_SCALAR = 1.0;
      float TO_CENTER_SCALAR = 0.003;

      void main() {
        vec3 prevPositionA = texture2D(prevState, uv).rgb;
        vec3 currPositionA = texture2D(currState, uv).rgb;
        vec3 deltaPositionA = currPositionA - prevPositionA;
        vec3 directionA = normalize(deltaPositionA);
        float distanceA = length(deltaPositionA);

        float noiseOffset = tick * 0.01 + uv.x;
        float phi = TAU * noise3d(vec3(
          NOISE_DENSITY * currPositionA.xy,
          NOISE_SPEED + noiseOffset
        ));
        float theta = TAU * noise3d(vec3(
          NOISE_DENSITY * currPositionA.xy + 100.0,
          NOISE_SPEED + noiseOffset
        ));
        vec3 noiseDirection = vec3(
          sin(theta) * cos(phi),
          sin(theta) * sin(phi),
          cos(theta)
        );

        // Make things want to return to the center of the screen.
        vec3 origin = vec3(0.0);
        vec3 toCenter = origin - currPositionA;
        float toCenterLength = length(toCenter);
        toCenter /= toCenterLength;

        // Combine the various directional vectors.
        vec3 direction = mix(directionA, normalize(
          noiseDirection * NOISE_SCALAR +
          toCenter * TO_CENTER_SCALAR * toCenterLength * toCenterLength
        ), TURN_SPEED);

        // Sum the forces
        float speed = 0.1;
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
      tick: ({tick}) => tick,
    },
    depth: { enable: false },
    count: 3,
    framebuffer: ({tick}) => state[(tick + 2) % 3]
  })

  const drawFlock = regl({
    vert: glsl`
      precision highp float;
      #pragma glslify: rotate2d = require(glsl-y-rotate/rotateY)
      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      #pragma glslify: lookAt = require('glsl-look-at')
      #pragma glslify: inverse = require(glsl-inverse)
      #pragma glslify: transpose = require(glsl-transpose)
      uniform mat4 projection, model, view;
      uniform mat3 normalView;
      uniform float viewportHeight;
      uniform sampler2D currState;
      uniform sampler2D prevState;
      uniform float time;

      varying vec3 vColor;
      varying vec3 vPosition;
      varying vec3 vNormal;

      float TAU = 6.283185307179586;
      float PI = TAU * 0.5;
      float HALF_PI = TAU * 0.25;

      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 coordinate;
      attribute float id;

      vec3 lighting(vec3 rotatedNormal, float depth) {
        float brightness = max(0.0, dot(rotatedNormal, vec3(0.0, 1.0, 0.0)));
        depth = depth * 3.0 - 4.0;
        vec3 hsl = hslToRgb(
          0.5,
          0.4,
          (0.4 + 0.75 * depth) * mix(0.4, 1.0, brightness)
        );
        vec3 normalColoring = (rotate2d(TAU * 0.6) * rotatedNormal) * 0.5 + 0.5;
        return mix(normalColoring, hsl, 0.5);
      }

      void main() {
        vec4 currPosition = texture2D(currState, coordinate);
        vec4 prevPosition = texture2D(prevState, coordinate);
        mat3 rotate = lookAt(prevPosition.xyz, currPosition.xyz, 0.0);

        // Transform everything into view space.
        vec4 position = view * model * (vec4(rotate * position, 1.0) + currPosition);
        vPosition = position.xyz;

        // The final calculation applies projection as well.
        gl_Position = projection * position;

        vec3 rotatedNormal = transpose(inverse(rotate)) * normal;

        // Turn the rotated normal into view space.
        vNormal = normalView * rotatedNormal;

        // Compute the base color.
        // TODO:
        // vColor = lighting(rotatedNormal, gl_Position.z);
        vec3 direction = currPosition.xyz - prevPosition.xyz;
        float positionHue = (1.0 + cos(2.0 * atan(currPosition.y, currPosition.z)));
        float directionHue = (1.0 + cos(2.0 * atan(direction.y, direction.z)));
        float baseHue = time * 0.1;

        vColor = hslToRgb(
          mod(abs(
            baseHue +
            positionHue * 0.05 +
            directionHue * 0.1
          ), 1.0),
          0.4,
          0.5
        );
      }
    `,
    // Use the geometry buffer shader for the rest of this.
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

  return { updateFlock, drawFlock }
}
