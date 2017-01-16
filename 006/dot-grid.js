const glsl = require('glslify')
const mat4 = require('gl-mat4')

const TAU = 6.283185307179586
const GRID_SCALE = 5.5
const GRID_SIDE = 30
const POINTS = Math.pow(GRID_SIDE, 3)

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      uniform mat4 projection, model, view;
      uniform float time, pixelRatio, viewportHeight;
      uniform vec3 light1;
      attribute vec3 position;
      attribute float id;
      varying vec3 vColor;
      varying float depth;

      float POINT_SIZE = 0.007;
      float BRIGHTNESS = 0.05;

      void main () {
        gl_Position = projection * view * model * vec4(position, 1.0);
        float size = 1.0;
        vColor = BRIGHTNESS * vec3(0.5, 1.0, 1.0);

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
      position: Array(POINTS).fill(0).map((n, i) => {
        return [
          GRID_SCALE * (GRID_SIDE / 2 - i % GRID_SIDE),
          GRID_SCALE * (GRID_SIDE / 2 - Math.floor(i / GRID_SIDE) % GRID_SIDE),
          GRID_SCALE * (GRID_SIDE / 2 - Math.floor(i / GRID_SIDE / GRID_SIDE) % GRID_SIDE)
        ]
      }),
      id: Array(POINTS).fill(0).map((n, i) => i)
    },
    count: POINTS,
    uniforms: {
      time: ({time}) => time,
      viewportHeight: ({viewportHeight}) => viewportHeight,
      pixelRatio: () => window.devicePixelRatio,
      light1: ({light1}) => light1,
      model: mat4.rotateY([], mat4.identity([]), TAU * 1 / 8),
      radius: GRID_SIDE
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
