const glsl = require('glslify')

module.exports = function createDrawBloom (regl, drawPass) {
  const drawBloom = regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: toGamma = require('glsl-gamma/out')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      varying vec2 vUv;
      uniform vec2 resolution, ratio;
      uniform sampler2D sourceFBO;
      uniform float intensity, exponent, dimSource, time, scale;

      float EXPONENT = 1.5;
      float INTENSITY = 0.0;
      float SOURCE_DIM = 1.0;

      void main() {
        vec2 uv = vUv;
        vec3 sourceColor = texture2D(sourceFBO, uv).xyz;
        vec3 blurColor = blur13(sourceFBO, uv, resolution, vec2(0.0, 8.0)).xyz;
        float centerRatio = 1.0 - length(ratio * (vUv * 2.0 - 1.0));
        vec3 color = mix(blurColor, sourceColor, min(1.0, centerRatio + 0.5));
        float vignette = mix(centerRatio + 0.5, 1.0, 0.5);
        float boost = 1.5;
        float NOISE_AMOUNT = 0.1;
        float noise = mix(0.95, 1.0, snoise3(vec3(vUv * resolution * 0.1, time * 0.5)));
        gl_FragColor = vec4(noise * boost * color * vignette, 1.0);
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
