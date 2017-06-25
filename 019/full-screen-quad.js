const glsl = require('glslify')

module.exports = function(regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec2 position;
      varying vec2 vUv;
      void main () {
        vUv = position;
        gl_Position = vec4(2.0 * position - 1.0, 0, 1);
      }
    `,
    attributes: {
      position: [
        -2, 0,
        0, -2,
        2, 2
      ]
    },
    count: 3,
  });
}
