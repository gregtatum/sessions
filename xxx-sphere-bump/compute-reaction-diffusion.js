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
      float KILL_RATE = 0.062;
      float TIME_SCALE = 0.8;
      float WAVE_SPEED = 3.0;
      float WAVE_PERIOD = 50.0;
      float FEED_SPREAD_MAX = 0.1;
      float FEED_SPREAD_MIN = 0.0;

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
        float feedRateWave = mix(
          0.5,
          1.0,
          (sin(WAVE_SPEED * time + vUv.x * WAVE_PERIOD) + 1.0) * 0.4 +
          (sin(WAVE_SPEED * 1.89 * time + vUv.x * WAVE_PERIOD * 3.2) + 1.0) * 0.2
        );
        float feedRateSpread = mix(
          FEED_SPREAD_MAX,
          FEED_SPREAD_MIN,
          length(pow(vec2(0.5, viewportRatio) * (vUv - 0.5) * 2.0, vec2(0.5)))
        );
        float feed = feedRateWave * (FEED_RATE + feedRateSpread) * (1.0 - a);
        float kill = (KILL_RATE + FEED_RATE) * b;
        gl_FragColor = vec4(
          a + (DIFFUSION_RATE_A * laplacianA - reaction + feed) * TIME_SCALE,
          b + (DIFFUSION_RATE_B * laplacianB + reaction - kill) * TIME_SCALE,
          0.0,
          1.0
        );
      }
    `,
    uniforms: {
      texture: texture,
      time: (_, {tick}) => 0.001 * tick,
      viewportWidth: regl.context('viewportWidth'),
      viewportHeight: regl.context('viewportHeight'),
      viewportRatio: ({viewportWidth, viewportHeight}) => viewportHeight / viewportWidth,
      neighborX: ({viewportWidth}) => 1 / viewportWidth,
      neighborY: ({viewportHeight}) => 1 / viewportHeight,
    }
  })
}
