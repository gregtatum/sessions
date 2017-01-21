const glsl = require('glslify')

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec2 position;
      uniform mat4 inverseProjection, inverseView;
      varying vec3 vDirection;

      void main () {
        vDirection = mat3(inverseView) * (inverseProjection * vec4(position, 0, 1)).xyz;
        gl_Position = vec4(position, 0.999, 1);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: computeBackground = require(./background)

      uniform float time;
      varying vec3 vDirection;

      void main () {
        vec3 direction = normalize(vDirection);
        gl_FragColor = computeBackground(direction, time);
      }
    `,
    attributes: {
      position: [[-4, -4], [0, 4], [4, -4]]
    },
    count: 3
  })
}
