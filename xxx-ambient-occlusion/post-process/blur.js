const glsl = require('glslify')
const vec2 = require('gl-vec2')
const defaultProps = {
  scratchFBO: null,
  divisor: 1
}

module.exports = function (regl, drawPass, {scratchFBO, divisor} = defaultProps) {
  const blurHorizontalFBO = scratchFBO || regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp',
      mag: 'linear',
      min: 'linear'
    }),
    depth: true
  })
  const blurFBO = regl.framebuffer({
    color: regl.texture({
      wrap: 'clamp',
      mag: 'linear',
      min: 'linear'
    }),
    depth: true
  })

  const drawBlur = regl({
    frag: glsl`
      precision mediump float;
      #pragma glslify: blur5 = require('glsl-fast-gaussian-blur/5')
      #pragma glslify: blur9 = require('glsl-fast-gaussian-blur/9')
      #pragma glslify: blur13 = require('glsl-fast-gaussian-blur/13')

      varying vec2 vUv;
      uniform sampler2D sourceFBO;
      uniform vec2 resolution;
      uniform vec2 direction;

      void main() {
        gl_FragColor = blur13(sourceFBO, vUv, resolution, direction);
      }
    `,
    uniforms: {
      sourceFBO: regl.prop('sourceFBO'),
      resolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
      direction: ({viewportHeight}, {direction, blurSize}) => {
        return vec2.scale([], direction, viewportHeight * blurSize / divisor)
      }
    },
    context: {
      updateBlurFBOs: ({viewportWidth, viewportHeight}) => {
        blurHorizontalFBO.resize(viewportWidth / divisor, viewportHeight / divisor)
        blurFBO.resize(viewportWidth / divisor, viewportHeight / divisor)
      }
    },
    framebuffer: regl.prop('targetFrame'),
    depth: { enable: false },
    count: 3
  })

  const useBlurBuffer = regl({
    context: {
      blurFBO: regl.prop('blurFBO')
    }
  })

  const horizontal = [1, 0]
  const vertical = [0, 1]
  const blurSize = 0.003
  const blurHProps = {
    direction: horizontal,
    blurSize,
    targetFrame: blurHorizontalFBO
  }
  const blurHVProps = {
    direction: vertical,
    blurSize,
    sourceFBO: blurHorizontalFBO,
    targetFrame: blurFBO
  }
  const blurFBOProp = {blurFBO}
  const withDrawPass = ({sourceFBO}) => {
    blurHProps.sourceFBO = sourceFBO
    drawBlur(blurHProps)
    drawBlur(blurHVProps)
  }

  return (props, callback) => {
    drawPass(props, withDrawPass)
    return useBlurBuffer(blurFBOProp, callback)
  }
}
