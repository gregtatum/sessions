const glsl = require('glslify')

module.exports = function createComputeReactionDiffusion(regl, texture) {
  return regl({
    frag: glsl`
      precision highp float;
      uniform sampler2D texture;
      uniform float time, viewportWidth, viewportHeight, viewportRatio, neighborX, neighborY;
      varying vec2 vUv;

      float DIFFUSION_RATE_A = 1.0;
      float DIFFUSION_RATE_B = 0.5;
      float FEED_RATE = 0.055;
      float KILL_RATE = 0.064;
      // float FEED_RATE = 0.0367;
      // float KILL_RATE = 0.0649;
      float TIME_SCALE = 1.0;

      void main () {
        vec4 center = texture2D(texture, vUv);
        float a = center.x;
        float b = center.y;
        vec4 adjacentNeighbors = 0.20 * (
          texture2D(texture, vUv + vec2(neighborX, 0.0)) +
          texture2D(texture, vUv + vec2(0.0, neighborY)) +
          texture2D(texture, vUv + vec2(-neighborX, 0.0)) +
          texture2D(texture, vUv + vec2(0.0, -neighborY))
        );
        vec4 cornerNeighbors = 0.05 * (
          texture2D(texture, vUv + vec2(neighborX, neighborY)) +
          texture2D(texture, vUv + vec2(neighborX, -neighborY)) +
          texture2D(texture, vUv + vec2(-neighborX, -neighborY)) +
          texture2D(texture, vUv + vec2(-neighborX, neighborY))
        );

        float laplacianA = -a + adjacentNeighbors.x + cornerNeighbors.x;
        float laplacianB = -b + adjacentNeighbors.y + cornerNeighbors.y;
        float reaction = a * b * b;
        float feedRateSpread = mix(0.005, -0.005, length(vec2(1.0, viewportRatio) * (vUv - 0.5)) * 2.0);
        feedRateSpread = 0.002;
        float feed = (FEED_RATE + feedRateSpread) * (1.0 - a);
        float kill = (KILL_RATE + FEED_RATE) * b;
        gl_FragColor = vec4(
          0.001 + a + (DIFFUSION_RATE_A * laplacianA - reaction + feed) * TIME_SCALE,
          b + (DIFFUSION_RATE_B * laplacianB + reaction - kill) * TIME_SCALE,
          0.0,
          1.0
        );
      }
    `,
    uniforms: {
      texture: texture,
      time: ({tick}) => 0.001 * tick,
      viewportWidth: regl.context('viewportWidth'),
      viewportHeight: regl.context('viewportHeight'),
      viewportRatio: ({viewportWidth, viewportHeight}) => viewportHeight / viewportWidth,
      neighborX: ({viewportWidth}) => 1 / viewportWidth,
      neighborY: ({viewportHeight}) => 1 / viewportHeight,
    }
  })
}
