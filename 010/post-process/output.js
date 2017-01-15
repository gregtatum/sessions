const glsl = require('glslify')

module.exports = function createDrawBloom (regl, drawPass) {
  const drawBloom = regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: toGamma = require('glsl-gamma/out')
      #pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
      #pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
      varying vec2 vUv;
      uniform sampler2D sourceFBO, blurFBO;
      uniform float intensity, exponent, dimSource, time, scale;

      float EXPONENT = 2.0;
      float INTENSITY = 0.5;
      float SOURCE_DIM = 1.0;

      void main() {
        vec2 uv = vUv;
        vec3 sourceColor = texture2D(sourceFBO, uv).xyz;
        vec3 blurColor = pow(texture2D(blurFBO, uv).xyz, vec3(EXPONENT));
        float vignette = clamp(0.0, 1.0, mix(1.0, 0.8, pow(2.0 * length(vUv - 0.5), 5.0)));
        vec3 vignetteColor = vec3(0.1, 0.09, 0.07);
        vec3 bloomColor = SOURCE_DIM * sourceColor + blurColor * INTENSITY;
        gl_FragColor = vec4(toGamma(mix(vignetteColor, bloomColor, vignette)), 1.0);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      sourceFBO: regl.prop('sourceFBO'),
      blurFBO: regl.prop('blurFBO'),
      time: ({time}) => time,
      scale: ({viewportHeight}) => viewportHeight
    },
  })

  return (props) => {
    drawPass({sourceFBO: props.sourceFBO}, () => {
      drawBloom(props)
    })
  }
}
