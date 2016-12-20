const glsl = require('glslify')
const TAU = 6.283185307179586
const lerp = require('lerp')
const POINTS = 10000
const MIN_RADIUS = 0.3
const MAX_RADIUS = 0.4

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;

      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      #pragma glslify: rotate2d = require('glsl-y-rotate')

      uniform mat4 projection, model, view, normalMatrix;
      uniform float time, pixelRatio, radius, viewportHeight;
      uniform vec3 light1;
      attribute vec3 position;
      attribute float id;
      varying vec3 vColor;
      varying float depth;

      float POINT_SIZE = 0.002;
      float BRIGHTNESS = 0.4;
      float SPEED_VARIANCE = 0.5;
      float SPEED = 0.05;

      void main () {
        float speedShift = mix(SPEED_VARIANCE, 1.0, (mod(id, 17.0) / 17.0));
        vec2 position2 = rotate2d(time * speedShift * SPEED) * position.xz;
        vec3 position3 = vec3(position2.x, position.y, position2.y);
        gl_Position = projection * view * model * vec4(position3, 1.0);
        float hue = (mod(id, 10.0) / 10.0);
        vColor = hslToRgb(0.2 * hue - 0.05, 0.5, (1.3 - gl_Position.z) * 0.5);
        gl_PointSize = POINT_SIZE * viewportHeight;
      }`,
    frag: `
      precision mediump float;
      varying vec3 vColor;
      varying float depth;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }`,
    attributes: {
      position: Array(POINTS).fill(0).map(() => {
        const theta = Math.random() * TAU
        let distance = Math.random() * (MAX_RADIUS - MIN_RADIUS) + MIN_RADIUS
        if (Math.random() < 0.33) {
          distance = lerp(MIN_RADIUS, distance, Math.random() * Math.random())
        } else if (Math.random() < 0.5) {
          distance = lerp(MAX_RADIUS, distance, Math.random() * Math.random())
        }
        return [
          Math.cos(theta) * distance,
          0,
          Math.sin(theta) * distance
        ]
      }),
      id: Array(POINTS).fill(0).map((n, i) => i)
    },
    count: POINTS,
    uniforms: {
      time: ({time}) => time,
      viewportHeight: ({viewportHeight}) => viewportHeight,
      pixelRatio: () => window.devicePixelRatio,
      projection: ({projection}) => projection,
      view: ({view}) => view,
      model: ({planetTilt}) => planetTilt,
      normalMatrix: ({planetTiltNormal}) => planetTiltNormal,
      light1: ({light1}) => light1,
      radius: MAX_RADIUS
      // model: mat4.rotateX([], mat4.identity([]), TAU * 0.25)
    },
    primitive: 'points',
    lineWidth: Math.min(2 * window.devicePixelRatio, regl.limits.lineWidthDims[1]),
    blend: {
      enable: true,
      func: {
        srcRGB: 'one',
        srcAlpha: 1,
        dstRGB: 'one',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    }
  })
}
