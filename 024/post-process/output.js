const glsl = require('glslify')

module.exports = function createDrawBloom (regl, drawPass) {
  const drawBloom = regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: toGamma = require('glsl-gamma/out')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')
      #pragma glslify: noise3d = require(glsl-noise/simplex/3d)
      #pragma glslify: noise2d = require(glsl-noise/simplex/2d)
      varying vec2 vUv;
      uniform vec2 resolution, ratio;
      uniform sampler2D sourceFBO;
      uniform float intensity, exponent, dimSource, time, scale;

      float EXPONENT = 1.5;
      float INTENSITY = 0.0;
      float SOURCE_DIM = 1.0;

      float ABERRATION = 0.01;
      void main() {
        vec2 uv = vUv;
        float centerRatio = 1.0 - length(ratio * (vUv * 2.0 - 1.0));

        float distanceFromCenter = length(uv - 0.5);
        distanceFromCenter *= distanceFromCenter;
        float aberration = distanceFromCenter * (ABERRATION + 0.005 * noise2d(vUv * 200.0));
        vec3 sourceColor = vec3(
          texture2D(sourceFBO, uv).r,
          texture2D(sourceFBO, uv + aberration * 0.5).g,
          texture2D(sourceFBO, uv + aberration).b
        );

        vec3 color = sourceColor;
        float vignette = min(1.0, 1.0 - distanceFromCenter * 2.0);
        float boost = 1.5;
        float NOISE_AMOUNT = 0.1;
        gl_FragColor = vec4(boost * color * vignette, 1.0);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      resolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
      sourceFBO: regl.context('sceneFBO'),
      time: ({time}) => time,
      scale: ({viewportHeight}) => viewportHeight,
      ratio: ({viewportWidth, viewportHeight}) => [viewportWidth / viewportHeight, 1],
    }
  })

  return (props) => {
    drawPass({sourceFBO: props.sourceFBO}, () => {
      drawBloom()
    })
  }
}
