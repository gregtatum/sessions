const glsl = require('glslify')
const random = require('random-spherical/array')()

const POINTS = 10000
const RADIUS = 4.0

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      uniform mat4 projection, model, view, normalMatrix;
      uniform float time, pixelRatio, radius, viewportHeight;
      uniform vec3 light1;
      attribute vec3 position;
      attribute float id;
      varying vec3 vColor;
      varying float depth;

      float POINT_SIZE = 0.007;
      float BRIGHTNESS = 0.4;

      void main () {
        vec3 normal = vec4(normalMatrix * vec4(normalize(position), 1.0)).xyz;
        gl_Position = projection * view * model * vec4(position, 1.0);

        float size = mix(0.5, 1.0, mod(id, 10.0) / 10.0);
        size *= size;
        float brightnessVariance = mix(0.5, 1.0, mod(id, 13.0) / 13.0);
        brightnessVariance *= brightnessVariance;
        vColor = vec3(1.0, 1.0, 0.5) * BRIGHTNESS * size * brightnessVariance;
        float flashing = mix(0.8, 1.0,
          sin(id * 0.01 + time * mix(5.0, 30.0, mod(id, 10.0) / 10.0))
        );

        gl_PointSize = size * flashing * POINT_SIZE * viewportHeight;
      }`,
    frag: `
      precision mediump float;
      varying vec3 vColor;
      varying float depth;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }`,
    attributes: {
      position: Array(POINTS).fill(0).map(() => random(RADIUS)),
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
      radius: RADIUS
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
