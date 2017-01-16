module.exports = function createDrawBloom (regl, drawPass) {
  const drawBloom = regl({
    frag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D sourceFBO;
      uniform sampler2D blurFBO;
      uniform float intensity, exponent, dimSource;
      void main() {
        vec4 sourceColor = texture2D(sourceFBO, vUv);
        vec4 blurColor = pow(texture2D(blurFBO, vUv), vec4(exponent));
        gl_FragColor = dimSource * sourceColor + blurColor * intensity;
      }
    `,
    attributes: {
      position: [ -4, -4, 4, -4, 0, 4 ]
    },
    uniforms: {
      sourceFBO: regl.prop('sourceFBO'),
      blurFBO: regl.prop('blurFBO'),
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
