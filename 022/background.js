const glsl = require('glslify')

module.exports = function (regl) {
  return regl({
    vert: glsl`
      precision highp float;
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
      precision highp float;
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: hsl2rgb = require(glsl-hsl2rgb)

      uniform float time;
      varying vec3 vDirection;
      varying vec2 vUv;

      void main () {
        vec3 direction = normalize(vDirection);
        float topLight = mix(
          0.00, 0.5,
          0.5 + 0.5 * dot(direction, vec3(0.0, 1.0, 0.0))
        );

        float vignette = 1.0 - (pow(length(vUv * 0.8 + vec2(0.0, -0.2)), 4.0) * 0.5);
        float rawNoise = snoise3(vec3(
          direction.x * 5.0 + time * 0.5,
          direction.z * 15.0,
          time * 0.5
        ));
        float noise = mix(1.5, 1.7, rawNoise);
        vec3 baseColor = hsl2rgb(
          0.6 + sin(noise + time * 5.0 + direction.x * 5.0) * 0.01,
          0.7,
          0.6
        );
        baseColor = mix(vec3(hsl2rgb(0.2, 0.5, 0.5)), baseColor, vUv.y + 0.5);
        float boost = 1.3;

        float cloudWarble = 0.2 * snoise3(vec3(direction.xz * 3.0, time * 0.25));
        float cloudsUnitNoise = 0.5 + 0.5 * snoise3(vec3(
          2.0 * direction.x + time * 0.02,
          cloudWarble + 10.0 * direction.y,
          time * 0.05
        ));

        float clouds = 0.2 * min(1.0, 2.0 * cloudsUnitNoise * cloudsUnitNoise);

        gl_FragColor = vec4(
          boost * topLight * baseColor * vignette * noise + clouds,
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
