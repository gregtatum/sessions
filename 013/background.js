const glsl = require('glslify')

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision mediump float;
      attribute vec2 position;
      uniform mat4 inverseProjection, inverseView;
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
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)

      uniform float time;
      varying vec3 vDirection;
      varying vec2 vUv;

      void main () {
        vec3 direction = normalize(vDirection);
        float topLight = mix(
          0.00, 0.5,
          0.5 + 0.5 * dot(direction, vec3(0.0, 1.0, 0.0))
        );

        vec3 baseColor = vec3(0.8, 0.45, 0.35);
        float vignette = 1.0 - pow(length(vUv * 0.5), 2.0);
        float noise = mix(1.5, 1.7, snoise3(vec3(direction.xz * 7.0, time * 0.5)));

        gl_FragColor = vec4(
          topLight * baseColor * vignette * noise,
          1.0
        );
      }
    `,
    attributes: {
      position: [[-4, -4], [0, 4], [4, -4]]
    },
    count: 3
  })
}
