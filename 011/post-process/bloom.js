module.exports = function createDrawBloom (regl, drawPass) {
  const drawBloom = regl({
    frag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D sourceFBO;
      uniform sampler2D blurFBO;
      uniform float intensity, exponent, dimSource;

      float VIGNETTE_OUTER = -0.1;
      float VIGNETTE_INNER = 0.5;
      float VIGNETTE_AMOUNT = 0.75;

      void main() {
        vec4 sourceColor = texture2D(sourceFBO, vUv);

        // vignette
        float brightness0 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, vUv.x * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - vUv.x) * 2.0);
        float brightness1 = smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, vUv.y * 2.0) * smoothstep(VIGNETTE_OUTER, VIGNETTE_INNER, (1.0 - vUv.y) * 2.0);
        float vignette = mix(1.0, brightness0 * brightness1, VIGNETTE_AMOUNT);

        gl_FragColor = vec4((vignette * sourceColor.rgb), 1.0);
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      sourceFBO: regl.prop('sourceFBO'),
      dimSource: propGetter('dimSource', 1),
      intensity: propGetter('intensity', 1),
      exponent: propGetter('exponent', 2)
    }
  })

  return (props) => {
    drawPass({sourceFBO: props.sourceFBO}, () => {
      drawBloom(props)
    })
  }
}

function propGetter (key, defaultValue) {
  return (context, props) => {
    return typeof props[key] === 'undefined'
      ? defaultValue
      : props[key]
  }
}
