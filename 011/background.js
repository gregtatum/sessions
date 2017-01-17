const glsl = require('glslify')
const createIcosphere = require('icosphere')

module.exports = function (regl) {
  const sphere = createIcosphere(2)

  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec3 position;
      uniform mat4 projection, viewRotation;
      varying vec3 vPosition;
      varying vec2 vUv;

      void main() {
        vPosition = position;
        gl_Position = projection * viewRotation * vec4(position, 0.5);
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: computeBackground = require(./background)

      varying vec3 vPosition;
      uniform float time;

      #define PI ${Math.PI}

      void main () {
        vec3 direction = normalize(vPosition);
        gl_FragColor = computeBackground(direction, time);
      }
    `,
    attributes: {
      position: sphere.positions
    },
    depth: {
      mask: false,
      enable: false
    },
    elements: sphere.cells
  })
}
