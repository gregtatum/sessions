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

      float EXPONENT = 1.5;
      float INTENSITY = 1.0;
      float SOURCE_DIM = 1.0;

      void main() {
        float frameWarp = snoise3(vec3(vUv, time));
        vec2 uv = vUv + vec2(0.01, 0.0) * frameWarp;
        vec3 sourceColor = texture2D(sourceFBO, uv).xyz;
        vec3 blurColor = pow(texture2D(blurFBO, uv).xyz, vec3(EXPONENT));
        float noise = mix(0.005, 0.01, 0.5 + 0.5 * snoise3(vec3(uv * 0.5, time * 0.5)));
        float grain = mix(1.0, 1.5, 0.5 + 0.5 * snoise3(vec3(uv * scale * 0.1, time * 2.0)));
        float vignette = clamp(0.0, 1.0, mix(1.0, 0.8, pow(2.0 * length(vec2(frameWarp * 0.025, 0.0) + vUv - 0.5), 5.0)));
        vec3 vignetteColor = vec3(0.1, 0.09, 0.07);
        vec3 blurInOutColor = mix(sourceColor, blurColor, pow(snoise2(vec2(0.0, time * 0.5)) * 0.5 + 0.5, 4.0));
        vec3 bloomColor = SOURCE_DIM * blurInOutColor + blurColor * INTENSITY;
        gl_FragColor = vec4(toGamma(
          1.8 * pow(grain * noise + mix(vignetteColor, bloomColor, vignette), vec3(1.3))
        ), 1.0);
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
    }
  })

  return (props) => {
    drawPass({sourceFBO: props.sourceFBO}, () => {
      drawBloom(props)
    })
  }
}
