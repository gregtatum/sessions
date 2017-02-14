const glsl = require('glslify')
const TAU = 6.283185307179586

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec2 position;
      uniform mat4 inverseProjection, inverseView;
      uniform mat3 normalView;
      varying vec3 vDirection;
      varying vec2 vUv;

      void main () {
        vDirection = mat3(inverseView) * (inverseProjection * vec4(position, 0, 1)).xyz;
        gl_Position = vec4(position, 0.999, 1);
        vUv = gl_Position.xy;
      }
    `,
    frag: glsl`
      precision mediump float;
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)

      uniform float time, viewportHeight;
      varying vec3 vDirection;
      varying vec2 vUv;
      float TAU = 6.283185307179586;

      float unitSin(float x) {
        return sin(x * TAU) * 0.5 + 0.5;
      }
      float unitCos(float x) {
        return sin(x * TAU) * 0.5 + 0.5;
      }
      float unitSnoise2 (vec2 vec) {
        return snoise2(vec) * 0.5 + 0.5;
      }
      float unitSnoise3 (vec3 vec) {
        return snoise3(vec) * 0.5 + 0.5;
      }

      void main () {
        vec3 direction = normalize(vDirection);
        vec3 green = vec3(0.3, 0.5, 0.3) * unitSnoise2(2.0 * vec2(sin(5.0 * direction.y) + direction.x + time * 0.01, direction.y));
        vec3 yellow = vec3(0.5, 0.4, 0.3) * unitSnoise2(6.0 * vec2(direction.x, direction.y + time * 0.01));
        float grain = 0.02 * snoise3(direction * viewportHeight * 0.2);
        float height = clamp(0.4, 1.0, direction.y * 2.0 + 1.4);
        float vignette = 1.0 - pow(length(vUv * 0.6), 3.0);
        vec3 ambient = vec3(0.5, 0.6, 0.3);
        vec3 color = vignette * height * mix(ambient, green + yellow, 0.4) + grain;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    attributes: {
      position: [[-4, -4], [0, 4], [4, -4]]
    },
    uniforms: {
      viewportHeight: regl.context('viewportHeight')
    },
    count: 3
  })
}
