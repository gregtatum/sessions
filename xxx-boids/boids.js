const glsl = require('glslify')
const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
const simplex = new (require('simplex-noise'))()
const random = require('random-spherical/array')()
const createPlane = require('primitive-plane')

const RADIUS = 32
const COUNT = RADIUS * RADIUS
const MODEL_SCALE = 0.01
const ROTATE_SPEED = 0.0
const PASS_DIVISOR = 32
const POINT_RADIUS = 0.3
const INITIAL_SPEED = POINT_RADIUS / 1000
const PARTICLE_INITIAL_OFFSET_UP = 0.1;
const REFLECTION_DAMPING = 0.6
const GROUND_OFFSET = `vec3(0.0, 0.2, 0.2)`;
const POINT_SIZE = '5.0'
const GROUND_FN = name => `
  ${name}.x * ${name}.x +
  ${name}.z * ${name}.z +
  0.01 * sin(20.0 * ${name}.x + tick * 0.2)
`
const GROUND_DFDX = name => `2.0 * ${name}.x`
const GROUND_DFDZ = name => `2.0 * ${name}.z`

module.exports = function (regl, initialCenter) {
  const initialPositions = Array(COUNT).fill().map((n, i) => {
    const point = random(Math.sqrt(Math.random()) * POINT_RADIUS)
    return point
  })
  console.log(initialCenter)
  const state = Array(3).fill().map((n, pass) => (
    regl.framebuffer({
      color: regl.texture({
        radius: RADIUS,
        data: (() => {
          const buffer = new Float32Array(COUNT * 4)
          const target = []
          for (let i = 0; i < COUNT; i++) {
            const position = initialPositions[i]
            buffer[i * 4 + 0] = initialCenter[0] / MODEL_SCALE + position[0] + (Math.random() - 0.5) * 0.01
            buffer[i * 4 + 1] = initialCenter[1] / MODEL_SCALE + position[1] + pass * INITIAL_SPEED + PARTICLE_INITIAL_OFFSET_UP
            buffer[i * 4 + 2] = initialCenter[2] / MODEL_SCALE + position[2]
            buffer[i * 4 + 3] = 0
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
      precision mediump float;
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: range = require(glsl-range)

      uniform sampler2D currState, prevState;
      uniform float time, passStep;
      uniform vec3 target;
      varying vec2 uv;

      float TAU = 6.283185307179586;
      float PI = 3.141592653589793;
      float DAMPING = 0.001;
      float NOISE_FORCE = 100.0;
      float NOISE_SCALE = 0.05;
      float NOISE_SPEED = 0.1;
      float BASE_SPEED = 0.1;
      float STAGE_RADIUS = 1.0;
      float MAX_STAGE_RADIUS = 1.8;

      // Weights
      float ALIGNMENT_WEIGHT = 0.25 * 0.0;
      float ADHESION_WEIGHT = 0.25 * 0.0;
      float REPULSION_WEIGHT = 0.5 * 0.0;
      float TO_TARGET_WEIGHT = 0.8;
      float WANDER_WEIGHT = 0.1;
      float ALIGNMENT_POWER = 1.5;
      float REPULSION_POWER = 2.0;

      void main() {
        vec3 prevPositionA = texture2D(prevState, uv).rgb;
        vec3 currPositionA = texture2D(currState, uv).rgb;
        vec3 deltaPositionA = currPositionA - prevPositionA;
        vec3 directionA = normalize(deltaPositionA);
        float distanceA = length(deltaPositionA);

        // To target forces.
        vec3 toTarget = 0.5 * (1.1 + sin(time)) * normalize(target - currPositionA);
        float distanceToTarget = length(currPositionA - target);
        toTarget *= range(STAGE_RADIUS, MAX_STAGE_RADIUS, min(MAX_STAGE_RADIUS, max(STAGE_RADIUS, distanceToTarget)));

        // Wandering forces.
        float wanderTheta = TAU * snoise3(vec3(1.0 * uv, time * 0.5));
        float wanderPhi = PI * 0.5 * snoise3(vec3(1.0 * uv, time * 0.5));
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
          alignment += directionB * pow(unitDistance, ALIGNMENT_POWER);
          adhesion += directionBetween * unitDistance;
          repulsion -= directionBetween * pow(unitDistance, REPULSION_POWER);
        }

        vec3 direction = mix(directionA, normalize(
            ALIGNMENT_WEIGHT * normalize(alignment) +
            ADHESION_WEIGHT * normalize(adhesion) +
            REPULSION_WEIGHT * normalize(repulsion) +
            TO_TARGET_WEIGHT * toTarget +
            WANDER_WEIGHT * wander
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
      target: regl.context('time'),
      tick: regl.context('tick'),
      target: (_, {target}) => vec3.scale([], target, 1 / MODEL_SCALE)
    },
    depth: { enable: false },
    count: 3,
    framebuffer: ({tick}) => state[(tick + 2) % 3]
  })

  const drawParticles = regl({
    vert: glsl`
      precision highp float;
      uniform mat4 projView, model;
      uniform float viewportHeight, time;
      uniform sampler2D currState, prevState;
      uniform vec3 cameraPosition, cameraUpDirection;

      varying vec3 vColor;

      float TAU = 6.283185307179586;
      float TRIANGLE_SIZE = 0.02;

      attribute vec2 coordinate;
      attribute float id;

      mat4 rotationMatrix(vec3 axis, float angle) {
        axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;

        return mat4(
          oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, 0.0,
          oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, 0.0,
          oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c, 0.0,
          0.0, 0.0, 0.0, 1.0
        );
      }

      void main () {
        vec4 currPosition = texture2D(currState, coordinate);
        vec4 prevPosition = texture2D(prevState, coordinate);
        vec3 deltaPosition = currPosition.xyz - prevPosition.xyz;

        vec3 toCamera = normalize(cameraPosition - (model * currPosition).xyz);
        vec3 cameraOrthogonal = normalize(cross(toCamera, cameraUpDirection));
        vec2 cameraParticleDirection = normalize(vec2(
          // Project the delta position onto the i and j vectors of the camera.
          dot(cameraOrthogonal, deltaPosition),
          dot(cameraUpDirection, deltaPosition)
        ));
        float directionTheta = -atan(cameraParticleDirection.y, cameraParticleDirection.x);

        float instanceId = floor(id / 3.0);
        float theta = TAU * 0.5 + directionTheta + mod(id, 3.0) * TAU / 3.0;

        if (mod(id, 3.0) == 1.0) {
          theta += 0.5;
        }
        if (mod(id, 3.0) == 2.0) {
          theta -= 0.5;
        }

        vec4 trianglePosition = (
          rotationMatrix(toCamera, theta)
            * vec4(cameraOrthogonal * TRIANGLE_SIZE, 1.0)
            + model * currPosition
        );

        // float speed = distance(currPosition, prevPosition);
        float speed = (prevPosition.y - currPosition.y);
        currPosition.w = 1.0;
        gl_PointSize = ${POINT_SIZE};
        gl_Position = projView * trianglePosition;
        vColor = vec3(0.3, 1.0, 0.7) * mix(0.5, 1.0, mod(instanceId, 10.0) * 0.1);
      }
    `,
    frag: glsl`
      precision highp float;
      varying vec3 vColor;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    attributes: {
      coordinate: Array(COUNT * 3)
        .fill(0)
        .map((n, i) => Math.floor(i / 3))
        .map(i => [
          (i % RADIUS) / RADIUS,
          Math.floor(i / RADIUS) / RADIUS
        ]),
      id: Array(COUNT * 3).fill(0).map((n, i) => i)
    },
    count: COUNT * 3,
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
    // primitive: 'points'
  })

  return (props) => {
    updatePositions(props)
    drawParticles()
  }
}
