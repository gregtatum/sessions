const glsl = require('glslify')
const random = require('random-spherical/array')()

const POINTS = 10000
const RADIUS = 0.2

module.exports = function (regl) {
  return regl({
    vert: glsl`
      #pragma glslify: rotate2d = require(glsl-y-rotate)
      #pragma glslify: toGamma = require('glsl-gamma/out')
      #pragma glslify: hslToRgb = require('glsl-hsl2rgb')
      precision mediump float;
      uniform mat4 projection, model, view, normalMatrix;
      uniform float time, pixelRatio, radius, viewportHeight;
      uniform vec3 light1;
      attribute vec3 position;
      varying vec3 vColor;
      varying float depth;

      float POINT_SIZE = 0.007;
      float ROTATE_SPEED = 0.5;
      float ROTATE_PERIOD = 3.0;
      float HUE_RANGE = 0.3;
      float HUE_BASE = 0.7;
      float HUE_SATURATION = 0.5;
      float HUE_LIGHTNESS = 0.5;

      void main () {
        vec2 position2 = rotate2d(ROTATE_SPEED * sin(time + ROTATE_PERIOD * position.y / radius)) * position.xz;
        vec3 position3 = vec3(position2.x, position.y, position2.y);

        vec3 normal = vec4(normalMatrix * vec4(normalize(position3), 1.0)).xyz;
        gl_Position = projection * view * model * vec4(position3, 1.0);

        float brightness = max(dot(normal, light1), 0.05);
        vec3 baseColor = hslToRgb(HUE_BASE + HUE_RANGE * position.x / radius, HUE_SATURATION, HUE_LIGHTNESS) * brightness;
        vec3 fogColor = vec3(0.1);
        vColor = mix(baseColor, fogColor, max(0.0, min(1.0, 0.2 * gl_Position.z)));
        vColor = toGamma(vColor);
        float pointSizeByHeight = mix(0.2, 1.0, (1.0 - length(position.y) / radius));
        gl_PointSize = max(0.0, pointSizeByHeight * POINT_SIZE * viewportHeight * (2.0 - gl_Position.z));
      }`,
    frag: `
      precision mediump float;
      varying vec3 vColor;
      varying float depth;

      void main () {
        gl_FragColor = vec4(vColor, 1.0);
      }`,
    attributes: {
      position: Array(POINTS).fill(0).map(() => random(RADIUS))
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
    lineWidth: Math.min(2 * window.devicePixelRatio, regl.limits.lineWidthDims[1])
  })
}
