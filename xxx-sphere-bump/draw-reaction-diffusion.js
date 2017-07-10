const glsl = require('glslify')

module.exports = function createDrawReactionDiffusion (regl, texture) {
  return regl({
    frag: glsl`
      precision mediump float;
      uniform sampler2D texture;
      varying vec2 vUv;
      uniform float neighborX, neighborY, viewportWidth, viewportHeight, time;

      float NORMAL_DISTANCE = 5.0;

      vec3 getPosition(vec2 uv) {
        vec4 particles = texture2D(texture, uv);
        return vec3(
          uv.x,
          uv.y,
          pow((particles.x - particles.y), 0.5)
        );
      }

      vec3 getNormal(vec3 position, vec2 uv) {
        // Smooth out the normal by averaging several positions together
        vec3 a = (
          0.5 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE, 0.0)) +
          0.25 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, 0.0)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, neighborY * NORMAL_DISTANCE)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE * 2.0, -neighborY * NORMAL_DISTANCE))
        );
        vec3 b = (
          0.5 * getPosition(uv + vec2(0.0, neighborY * NORMAL_DISTANCE)) +
          0.25 * getPosition(uv + vec2(0.0, neighborY * NORMAL_DISTANCE * 2.0)) +
          0.125 * getPosition(uv + vec2(neighborX * NORMAL_DISTANCE, neighborY * NORMAL_DISTANCE * 2.0)) +
          0.125 * getPosition(uv + vec2(-neighborX * NORMAL_DISTANCE, neighborY * NORMAL_DISTANCE * 2.0))
        );
        return normalize(cross(
          normalize(a - position),
          normalize(b - position)
        ));
      }

      void main () {
        vec4 particles = texture2D(texture, vUv);
        float a = particles.x;
        float b = particles.y;
        vec3 position = getPosition(vUv);
        vec3 normal = getNormal(position, vUv);
        float brightness = 1.0 - 0.5 * (1.0 + dot(normal, vec3(0.0, 1.0, 0.0)));
        vec3 color = vec3(brightness) * 0.5
          + (1.0 - a) * vec3(1.0, 0.5, 0.0)
          + a * vec3(0.0, 0.2, 0.3);
        gl_FragColor = vec4(color * vec3(1.0 - position.z * 0.2), 1.0);
      }
    `,
    uniforms: {
      texture,
      time: ({tick}) => 0.001 * tick,
      viewportWidth: regl.context('viewportWidth'),
      viewportHeight: regl.context('viewportHeight'),
      viewportRatio: ({viewportWidth, viewportHeight}) => viewportHeight / viewportWidth,
      neighborX: ({viewportWidth}) => 1 / viewportWidth,
      neighborY: ({viewportHeight}) => 1 / viewportHeight,
    },
  })
}
